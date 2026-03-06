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
import {
  isMissingColumnError,
  isMissingRelationError,
  readLegacyTokenFromAccountRow,
} from '../_shared/token-store.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

const IG_API_BASE = 'https://graph.instagram.com/v25.0'
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
      .select('id, user_id, username, token_expires_at')
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

    const accountIds = accounts.map((a) => a.id)
    const { data: tokenRows, error: tokenRowsError } = await supabase
      .from('instagram_account_tokens')
      .select('account_id, user_id, access_token_enc')
      .in('account_id', accountIds)

    if (tokenRowsError && !isMissingRelationError(tokenRowsError)) {
      console.error('Failed to fetch token rows:', tokenRowsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch token rows' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenByAccount = new Map(
      (tokenRows ?? []).map((row) => [row.account_id, row]),
    )

    const { data: fbTokenRows, error: fbTokenRowsError } = await supabase
      .from('instagram_account_fb_tokens')
      .select('account_id, user_id, access_token_enc')
      .in('account_id', accountIds)

    if (fbTokenRowsError && !isMissingRelationError(fbTokenRowsError)) {
      console.error('Failed to fetch Business Login token rows:', fbTokenRowsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch Business Login token rows' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fbTokenByAccount = new Map(
      (fbTokenRows ?? []).map((row) => [row.account_id, row]),
    )

    const tokenTableMissing = isMissingRelationError(tokenRowsError)
    if (tokenTableMissing) {
      console.warn('Token table missing; token-refresh will use legacy account token column')
    }

    const results: Array<{
      accountId: string
      username: string
      success: boolean
      error?: string
    }> = []

    for (const account of accounts) {
      try {
        const fbTokenRow = fbTokenByAccount.get(account.id)
        const tokenRow = tokenByAccount.get(account.id)
        let encryptedToken = fbTokenRow?.access_token_enc ?? tokenRow?.access_token_enc ?? null

        if (
          !encryptedToken ||
          fbTokenRow?.user_id !== account.user_id ||
          tokenRow?.user_id !== account.user_id ||
          tokenTableMissing
        ) {
          const { data: legacyAccountRow, error: legacyTokenError } = await supabase
            .from('instagram_accounts')
            .select('access_token_enc')
            .eq('id', account.id)
            .eq('user_id', account.user_id)
            .maybeSingle()

          if (legacyTokenError && !isMissingColumnError(legacyTokenError)) {
            throw new Error(`Legacy token lookup failed: ${legacyTokenError.message}`)
          }

          encryptedToken = readLegacyTokenFromAccountRow(legacyAccountRow)
        }

        if (!encryptedToken) {
          throw new Error('Encrypted token row not found for account')
        }

        // Decrypt current token
        const currentToken = await decryptToken(encryptedToken, TOKEN_ENCRYPTION_KEY)

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

        const { error: accountUpdateError } = await supabase
          .from('instagram_accounts')
          .update({
            token_expires_at: newExpiresAt,
          })
          .eq('id', account.id)

        if (accountUpdateError) {
          throw new Error(`Account update failed: ${accountUpdateError.message}`)
        }

        if (tokenTableMissing) {
          const { error: legacyUpdateError } = await supabase
            .from('instagram_accounts')
            .update({
              access_token_enc: newTokenEnc,
            })
            .eq('id', account.id)
            .eq('user_id', account.user_id)

          if (legacyUpdateError && !isMissingColumnError(legacyUpdateError)) {
            throw new Error(`Legacy token update failed: ${legacyUpdateError.message}`)
          }
        } else {
          const { error: tokenUpdateError } = await supabase
            .from('instagram_account_tokens')
            .upsert(
              {
                account_id: account.id,
                user_id: account.user_id,
                access_token_enc: newTokenEnc,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'account_id' },
            )

          if (tokenUpdateError) {
            throw new Error(`Token update failed: ${tokenUpdateError.message}`)
          }
        }

        if (fbTokenRow || fbTokenRowsError === null) {
          const { error: fbTokenUpdateError } = await supabase
            .from('instagram_account_fb_tokens')
            .upsert(
              {
                account_id: account.id,
                user_id: account.user_id,
                access_token_enc: newTokenEnc,
                token_expires_at: newExpiresAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'account_id' },
            )

          if (fbTokenUpdateError && !isMissingRelationError(fbTokenUpdateError)) {
            throw new Error(`Business Login token update failed: ${fbTokenUpdateError.message}`)
          }
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
