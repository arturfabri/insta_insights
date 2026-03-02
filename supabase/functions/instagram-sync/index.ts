import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { withRetry, RateLimitError } from '../_shared/retry.ts'
import { resolveCallerAuth } from '../_shared/caller-auth.ts'
import { mapInstagramInsightsToDb } from '../_shared/instagram-insights-mapper.ts'
import { isMissingRelationError, readLegacyTokenFromAccountRow } from '../_shared/token-store.ts'

// ─── Environment ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// ─── Constants ───────────────────────────────────────────────────────────────

const IG_API_BASE = 'https://graph.instagram.com/v22.0'
const MEDIA_FIELDS =
  'id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count'
/** Hard cap on posts per sync run; raised to 400 to support up to 360-day windows */
const MAX_POSTS = 400
/** Stop fetching when this many API calls have been made to leave hourly headroom */
const RATE_CAP = 180

const VALID_PERIODS = [90, 180, 360] as const
type SyncPeriodDays = (typeof VALID_PERIODS)[number]

function cutoffDate(periodDays: SyncPeriodDays): Date {
  return new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
}

// ─── Instagram API types ─────────────────────────────────────────────────────

interface IGMediaItem {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type: string // 'REELS' | 'FEED' | 'STORY' | ...
  caption?: string
  permalink?: string
  thumbnail_url?: string
  media_url?: string
  timestamp: string // ISO 8601
  like_count?: number
}

interface IGMediaPage {
  data: IGMediaItem[]
  paging?: {
    cursors?: { before: string; after: string }
    next?: string
  }
}

interface IGInsightsResponse {
  data: Array<{
    name: string
    values: Array<{ value: number; end_time?: string }>
  }>
  error?: { message: string; type: string; code: number }
}

/** Return the comma-separated insight metric names for the given media type.
 *
 * API v22 (Instagram Platform — Instagram Login):
 * - `views` is the universal content-view metric for all types, replacing the
 *   deprecated `impressions` (IMAGE/CAROUSEL), `plays` (Reels), and
 *   `video_views` (non-Reel VIDEO).
 * - Reels additionally expose watch-time metrics:
 *     ig_reels_avg_watch_time          (milliseconds)
 *     ig_reels_video_view_total_time   (milliseconds)
 * - `profile_visits`, `follows`, `plays`, `video_views`, `impressions` are
 *   all deprecated in v22 and must NOT be requested.
 */
function insightFields(_mediaType: string, isReel: boolean): string {
  if (isReel) {
    return 'reach,views,ig_reels_video_view_total_time,ig_reels_avg_watch_time,saved,shares,comments'
  }
  // IMAGE, VIDEO (non-Reel), CAROUSEL_ALBUM
  return 'reach,views,saved,shares,comments'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // ── 1. Create client + parse body ───────────────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json().catch(() => ({})) as {
      accountId?: string
      syncType?: 'initial' | 'manual' | 'cron'
      syncPeriodDays?: number
    }

    // ── 2. Verify caller (user JWT or cron secret) ──────────────────────────
    const callerResult = await resolveCallerAuth(req, supabase, CRON_SECRET)
    if (!callerResult.success) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const caller = callerResult.caller

    // Validate and default the sync period
    const periodDays: SyncPeriodDays =
      VALID_PERIODS.includes(body.syncPeriodDays as SyncPeriodDays)
        ? (body.syncPeriodDays as SyncPeriodDays)
        : 90

    // ── 3. Fetch account ─────────────────────────────────────────────────────
    let accountQuery = supabase.from('instagram_accounts').select('*')
    if (caller.kind === 'user') {
      accountQuery = accountQuery.eq('user_id', caller.userId)
      if (body.accountId) {
        accountQuery = accountQuery.eq('id', body.accountId)
      }
    } else {
      if (!body.accountId) {
        return new Response(JSON.stringify({ error: 'accountId is required for cron sync' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      accountQuery = accountQuery.eq('id', body.accountId)
    }

    const { data: account, error: accountError } = await accountQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (accountError || !account) {
      return new Response(JSON.stringify({ error: 'Instagram account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accountUserId = account.user_id

    // ── 4. Concurrency guard ─────────────────────────────────────────────────
    // Allow override when the lock is stale (previous run timed out without
    // updating the status). updated_at is set by the trigger in migration 002
    // every time sync_status changes, so it reliably records when the lock
    // was acquired.
    const STALE_SYNC_MS = 10 * 60 * 1000 // 10 minutes
    if (account.sync_status === 'syncing') {
      const lockedSince = new Date(account.updated_at).getTime()
      const isStale = Date.now() - lockedSince > STALE_SYNC_MS
      if (!isStale) {
        return new Response(JSON.stringify({ error: 'Sync already in progress' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // Stale lock — the previous run timed out before finishing.
      // Fall through; step 6 will overwrite sync_status with a fresh timestamp.
      console.warn(
        `Stale sync lock on account ${account.id} (locked since ${account.updated_at}). Overriding.`,
      )
    }

    // ── 5. Fetch + decrypt access token ─────────────────────────────────────
    const { data: tokenRow, error: tokenError } = await supabase
      .from('instagram_account_tokens')
      .select('access_token_enc')
      .eq('account_id', account.id)
      .eq('user_id', accountUserId)
      .maybeSingle()

    let encryptedToken = tokenRow?.access_token_enc ?? null
    if (!encryptedToken) {
      encryptedToken = readLegacyTokenFromAccountRow(account)
      if (encryptedToken) {
        if (tokenError && isMissingRelationError(tokenError)) {
          console.warn('Token table missing; using legacy account token column')
        } else if (!tokenRow) {
          console.warn(`Token row missing for account ${account.id}; using legacy account token column`)
        }
      }
    }

    if (!encryptedToken) {
      const details = tokenError?.message ?? 'Token row missing and legacy token unavailable'
      console.error(`Token lookup failed for account ${account.id}: ${details}`)
      return new Response(JSON.stringify({ error: 'Access token record not found', details }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let accessToken: string
    try {
      accessToken = await decryptToken(encryptedToken, TOKEN_ENCRYPTION_KEY)
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to decrypt access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 6. Mark account as syncing ───────────────────────────────────────────
    await supabase
      .from('instagram_accounts')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('id', account.id)

    // ── 7. Create sync_log entry ─────────────────────────────────────────────
    const { data: syncLog } = await supabase
      .from('sync_logs')
      .insert({
        account_id: account.id,
        user_id: accountUserId,
        sync_type: body.syncType ?? 'manual',
        status: 'started',
      })
      .select('id')
      .single()

    // ── 8–9. Paginate Instagram media + fetch insights ───────────────────────
    let postsProcessed = 0
    let postsUpserted = 0
    let insightErrors = 0
    let firstInsightError: string | null = null
    let callCount = 0
    let isRateLimited = false
    let cursor: string | undefined
    let fetchMore = true
    const cutoff = cutoffDate(periodDays)
    console.log(`Sync period: ${periodDays} days (cutoff: ${cutoff.toISOString()})`)

    try {
      while (fetchMore && postsProcessed < MAX_POSTS && !isRateLimited) {
        // Build the /me/media URL
        const mediaUrl = new URL(`${IG_API_BASE}/me/media`)
        mediaUrl.searchParams.set('fields', MEDIA_FIELDS)
        mediaUrl.searchParams.set('limit', '50')
        mediaUrl.searchParams.set('access_token', accessToken)
        if (cursor) mediaUrl.searchParams.set('after', cursor)

        const mediaRes = await withRetry(() =>
          fetch(mediaUrl.toString()).then((r) => {
            callCount++
            if (!r.ok) throw r
            return r
          })
        )
        const mediaPage = (await mediaRes.json()) as IGMediaPage

        for (const item of mediaPage.data) {
          // Stop when post is older than the requested sync window
          if (new Date(item.timestamp) < cutoff) {
            fetchMore = false
            break
          }

          const isReel =
            item.media_type === 'VIDEO' && item.media_product_type === 'REELS'

          // ── Upsert instagram_media ─────────────────────────────────────────
          const { data: mediaRow, error: mediaErr } = await supabase
            .from('instagram_media')
            .upsert(
              {
                account_id: account.id,
                user_id: accountUserId,
                media_id: item.id,
                media_type: item.media_type,
                is_reel: isReel,
                caption: item.caption ?? null,
                permalink: item.permalink ?? null,
                thumbnail_url: item.thumbnail_url ?? null,
                media_url: item.media_url ?? null,
                timestamp: item.timestamp,
              },
              {
                onConflict: 'account_id,media_id',
                ignoreDuplicates: false,
              },
            )
            .select('id')
            .single()

          if (mediaErr || !mediaRow) {
            console.error(`Media upsert error for ${item.id}:`, mediaErr)
            postsProcessed++
            continue
          }

          // ── Fetch and upsert insights ──────────────────────────────────────
          try {
            const fields = insightFields(item.media_type, isReel)
            const insightsUrl = new URL(`${IG_API_BASE}/${item.id}/insights`)
            insightsUrl.searchParams.set('metric', fields)
            insightsUrl.searchParams.set('period', 'lifetime')
            insightsUrl.searchParams.set('access_token', accessToken)

            const insightsRes = await withRetry(() =>
              fetch(insightsUrl.toString()).then((r) => {
                callCount++
                if (!r.ok) throw r
                return r
              })
            )
            const insightsBody = (await insightsRes.json()) as IGInsightsResponse

            // Some posts return a top-level error instead of data.
            // Log code + message so we can diagnose metric name issues.
            if (insightsBody.error) {
              const errMsg = `[code ${insightsBody.error.code}] ${insightsBody.error.message}`
              console.warn(`Insights API error for ${item.id}: ${errMsg}`)
              insightErrors++
              if (!firstInsightError) firstInsightError = errMsg
              postsProcessed++
              continue
            }

            const insightsData = insightsBody.data ?? []
            const mappedInsights = mapInstagramInsightsToDb({
              insightsData,
              mediaType: item.media_type,
              isReel,
              likeCount: item.like_count ?? 0,
            })

            const { error: upsertErr } = await supabase
              .from('instagram_media_insights')
              .upsert(
                {
                  media_id_fk: mediaRow.id,
                  user_id: accountUserId,
                  ...mappedInsights,
                  synced_at: new Date().toISOString(),
                },
                { onConflict: 'media_id_fk' },
              )

            if (upsertErr) {
              console.error(`Insights upsert failed for ${item.id}:`, upsertErr)
            } else {
              postsUpserted++
            }
          } catch (insightsErr) {
            // Some posts (very old or incompatible) don't support insights.
            // Log and continue — never fail the whole sync for one post.
            if (insightsErr instanceof RateLimitError) {
              console.error('Rate limit exhausted during insights fetch')
              isRateLimited = true
              break
            }
            // Extract meaningful error from thrown Response objects
            let errStr: string
            if (insightsErr instanceof Response) {
              errStr = `HTTP ${insightsErr.status}`
              try {
                const body = await insightsErr.clone().json() as {
                  error?: { message?: string; code?: number; error_subcode?: number }
                }
                if (body.error?.message) {
                  errStr = body.error.code
                    ? `[${body.error.code}] ${body.error.message}`
                    : body.error.message
                }
              } catch { /* keep HTTP status message */ }
            } else if (insightsErr instanceof Error) {
              errStr = insightsErr.message
            } else {
              errStr = String(insightsErr)
            }
            console.warn(`Insights unavailable for media ${item.id}: ${errStr}`)
            insightErrors++
            if (!firstInsightError) firstInsightError = errStr
          }

          postsProcessed++

          // Safety: stop before exceeding the hourly call budget
          if (callCount >= RATE_CAP) {
            isRateLimited = true
            break
          }
        }

        if (isRateLimited) break

        // Advance cursor
        cursor = mediaPage.paging?.cursors?.after
        if (!mediaPage.paging?.next || !cursor) fetchMore = false
      }

      // ── 10. Update account status ──────────────────────────────────────────
      const finalStatus = isRateLimited ? 'partial' : 'complete'
      await supabase
        .from('instagram_accounts')
        .update({
          sync_status: finalStatus,
          last_synced_at: new Date().toISOString(),
          sync_error: isRateLimited
            ? 'Rate limit reached — partial sync completed'
            : null,
        })
        .eq('id', account.id)

      // ── 11. Update sync_log ────────────────────────────────────────────────
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: isRateLimited ? 'partial' : 'complete',
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      // ── 12. Return ─────────────────────────────────────────────────────────
      return new Response(
        JSON.stringify({
          success: true,
          postsProcessed,
          postsUpserted,
          insightErrors,
          firstInsightError,
          partial: isRateLimited,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } catch (syncErr) {
      // Build a descriptive message whether the thrown value is an Error,
      // a raw Response (thrown by `if (!r.ok) throw r` in fetch calls),
      // or something else entirely.
      let errorMessage = 'Unknown sync error'
      if (syncErr instanceof Error) {
        errorMessage = syncErr.message
      } else if (syncErr instanceof Response) {
        // withRetry rethrows non-429 Responses immediately; extract HTTP status
        // and, when possible, the JSON error body from the Instagram API.
        errorMessage = `Instagram API error (HTTP ${syncErr.status})`
        try {
          const body = await syncErr.clone().json() as {
            error?: { message?: string; code?: number }
          }
          if (body.error?.message) {
            errorMessage = body.error.code
              ? `[${body.error.code}] ${body.error.message}`
              : body.error.message
          }
        } catch {
          // body wasn't JSON — keep the HTTP-status message
        }
      } else {
        errorMessage = String(syncErr)
      }

      console.error('Sync loop error:', errorMessage)

      // Roll back to error status
      await supabase
        .from('instagram_accounts')
        .update({ sync_status: 'error', sync_error: errorMessage })
        .eq('id', account.id)

      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      return new Response(
        JSON.stringify({ error: 'Sync failed', details: errorMessage }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  } catch (err) {
    console.error('Unhandled error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
