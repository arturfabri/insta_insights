/**
 * token-refresh — triggered by a Supabase Dashboard Cron job (or pg_cron).
 *
 * Runs every Monday at 09:00 UTC. Finds all Instagram accounts whose
 * access token expires within 14 days and refreshes them via the Instagram
 * long-lived token refresh endpoint.
 *
 * Authentication: X-Cron-Secret header.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { encryptToken, decryptToken } from '../_shared/crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

const IG_API_BASE = 'https://graph.instagram.com/v21.0'
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const ONE_DAY_SEC = 86400

interface IGRefreshResponse {
  access_token: string
  token_type: string
  expires_in: number // seconds
  error?: { message: string; type: string; code: number }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('X-Cron-Secret')
    if (!cronSecret || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find accounts expiring within 14 days
    const cutoff = new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString()
    const { data: accounts, error: accountsError } = await supabase
      .from('instagram_accounts')
      .select('id, username, access_token_enc, token_expires_at')
      .lt('token_expires_at', cutoff)

    if (accountsError) {
      console.error('Failed to fetch expiring accounts:', accountsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch accounts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, refreshed: 0, message: 'No tokens need refreshing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const results: Array<{
      accountId: string
      username: string
      success: boolean
      error?: string
    }> = []

    for (const account of accounts) {
      try {
        // Decrypt current token
        const currentToken = await decryptToken(account.access_token_enc, TOKEN_ENCRYPTION_KEY)

        // Call the Instagram refresh endpoint
        const refreshUrl = new URL(`${IG_API_BASE}/refresh_access_token`)
        refreshUrl.searchParams.set('grant_type', 'ig_refresh_token')
        refreshUrl.searchParams.set('access_token', currentToken)

        const res = await fetch(refreshUrl.toString())
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errText}`)
        }

        const refreshData = (await res.json()) as IGRefreshResponse

        if (refreshData.error) {
          throw new Error(refreshData.error.message)
        }

        // Re-encrypt and store the new token
        const newTokenEnc = await encryptToken(refreshData.access_token, TOKEN_ENCRYPTION_KEY)
        const newExpiresAt = new Date(
          Date.now() + (refreshData.expires_in - ONE_DAY_SEC) * 1000,
        ).toISOString()

        const { error: updateError } = await supabase
          .from('instagram_accounts')
          .update({
            access_token_enc: newTokenEnc,
            token_expires_at: newExpiresAt,
          })
          .eq('id', account.id)

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`)
        }

        console.log(`Token refreshed for @${account.username}, expires ${newExpiresAt}`)
        results.push({ accountId: account.id, username: account.username, success: true })
      } catch (err) {
        console.error(`Token refresh failed for @${account.username}:`, err)
        results.push({
          accountId: account.id,
          username: account.username,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length
    console.log(`Token refresh complete: ${successCount} refreshed, ${errorCount} failed`)

    return new Response(
      JSON.stringify({ success: true, refreshed: successCount, errors: errorCount, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unhandled error in token-refresh:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
