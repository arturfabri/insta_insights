/**
 * daily-sync — triggered by a Supabase Dashboard Cron job (or pg_cron).
 *
 * Runs every day at 03:00 UTC. Iterates over all connected Instagram accounts
 * that are not currently syncing and triggers an instagram-sync for each.
 *
 * Authentication: verifies the X-Cron-Secret header against the CRON_SECRET
 * environment variable so only the scheduler can invoke this function.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')!

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify cron secret header
    const cronSecret = req.headers.get('X-Cron-Secret')
    if (!cronSecret || cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch all accounts not currently syncing
    const { data: accounts, error: accountsError } = await supabase
      .from('instagram_accounts')
      .select('id, user_id, username')
      .neq('sync_status', 'syncing')

    if (accountsError) {
      console.error('Failed to fetch accounts:', accountsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch accounts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No accounts to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const results: Array<{ accountId: string; username: string; success: boolean; error?: string }> =
      []

    for (const account of accounts) {
      try {
        const { error } = await supabase.functions.invoke('instagram-sync', {
          headers: { 'X-Cron-Secret': CRON_SECRET },
          body: { accountId: account.id, syncType: 'cron' },
        })

        if (error) {
          console.error(`Sync failed for account ${account.username}:`, error)
          results.push({ accountId: account.id, username: account.username, success: false, error: error.message })
        } else {
          results.push({ accountId: account.id, username: account.username, success: true })
        }
      } catch (err) {
        console.error(`Unhandled sync error for account ${account.username}:`, err)
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

    console.log(`Daily sync complete: ${successCount} succeeded, ${errorCount} failed`)

    return new Response(
      JSON.stringify({ success: true, processed: accounts.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Unhandled error in daily-sync:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
