import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { withRetry, RateLimitError } from '../_shared/retry.ts'

// ─── Environment ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!

// ─── Constants ───────────────────────────────────────────────────────────────

const IG_API_BASE = 'https://graph.instagram.com/v21.0'
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

interface IGInsightMetric {
  name: string
  period: string
  values: Array<{ value: number; end_time?: string }>
  title: string
  description: string
  id: string
}

interface IGInsightsResponse {
  data: IGInsightMetric[]
  error?: { message: string; type: string; code: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a single numeric metric value from the insights data array */
function extractMetric(data: IGInsightMetric[], name: string): number | null {
  const metric = data.find((m) => m.name === name)
  if (!metric) return null
  return metric.values?.[0]?.value ?? null
}

/** Return the comma-separated insight metric names for the given media type.
 *
 * Important API constraints (Graph API v21.0):
 * - `profile_visits` and `follows` are NOT valid per-media metrics for
 *   IMAGE / CAROUSEL_ALBUM / VIDEO. Requesting them causes the ENTIRE
 *   insights call to fail with a top-level error, silently skipping all
 *   metrics for that post. Only Reels expose `follows` at the media level.
 * - Reel watch-time metrics were renamed in v17+:
 *     avg_watch_time_video_viewed   → ig_reels_avg_watch_time  (still ms)
 *     total_value_video_views       → ig_reels_video_view_total_time
 */
function insightFields(mediaType: string, isReel: boolean): string {
  if (isReel) {
    return 'reach,plays,ig_reels_video_view_total_time,ig_reels_avg_watch_time,saved,shares,comments,follows'
  }
  if (mediaType === 'VIDEO') {
    return 'reach,impressions,video_views,saved,shares,comments'
  }
  // IMAGE and CAROUSEL_ALBUM
  return 'reach,impressions,saved,shares,comments'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({})) as {
      accountId?: string
      syncType?: 'initial' | 'manual' | 'cron'
      syncPeriodDays?: number
    }

    // Validate and default the sync period
    const periodDays: SyncPeriodDays =
      VALID_PERIODS.includes(body.syncPeriodDays as SyncPeriodDays)
        ? (body.syncPeriodDays as SyncPeriodDays)
        : 90

    // ── 3. Fetch account ─────────────────────────────────────────────────────
    let accountQuery = supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (body.accountId) {
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

    // ── 5. Decrypt access token ──────────────────────────────────────────────
    let accessToken: string
    try {
      accessToken = await decryptToken(account.access_token_enc, TOKEN_ENCRYPTION_KEY)
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
        user_id: user.id,
        sync_type: body.syncType ?? 'manual',
        status: 'started',
      })
      .select('id')
      .single()

    // ── 8–9. Paginate Instagram media + fetch insights ───────────────────────
    let postsProcessed = 0
    let postsUpserted = 0
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
                user_id: user.id,
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
              console.warn(
                `Insights API error for ${item.id} [code ${insightsBody.error.code}]: ${insightsBody.error.message}`,
              )
              postsProcessed++
              continue
            }

            const insightsData = insightsBody.data ?? []
            const reach = extractMetric(insightsData, 'reach') ?? 0
            const impressions = extractMetric(insightsData, 'impressions') ?? 0
            const saves = extractMetric(insightsData, 'saved') ?? 0
            const shares = extractMetric(insightsData, 'shares') ?? 0
            const comments = extractMetric(insightsData, 'comments') ?? 0
            const profileVisits =
              extractMetric(insightsData, 'profile_visits') ?? 0
            const follows = extractMetric(insightsData, 'follows') ?? 0
            const likes = item.like_count ?? 0

            // Type-specific metrics
            let plays: number | null = null
            let videoViews: number | null = null
            let avgWatchTimeSec: number | null = null

            if (isReel) {
              plays = extractMetric(insightsData, 'plays')
              // v17+ renamed these metrics; use the new names
              videoViews = extractMetric(insightsData, 'ig_reels_video_view_total_time')
              const rawAvg = extractMetric(insightsData, 'ig_reels_avg_watch_time')
              // API returns milliseconds — convert to seconds
              avgWatchTimeSec = rawAvg !== null ? rawAvg / 1000 : null
            } else if (item.media_type === 'VIDEO') {
              videoViews = extractMetric(insightsData, 'video_views')
            }

            const engagementRate =
              reach > 0
                ? (likes + comments + shares + saves) / reach
                : null

            const { error: upsertErr } = await supabase
              .from('instagram_media_insights')
              .upsert(
                {
                  media_id_fk: mediaRow.id,
                  user_id: user.id,
                  reach,
                  impressions,
                  plays,
                  video_views: videoViews,
                  avg_watch_time_sec: avgWatchTimeSec,
                  total_watch_time_ms: null, // not available in current API version
                  likes,
                  comments,
                  shares,
                  saves,
                  profile_visits: profileVisits,
                  follows,
                  engagement_rate: engagementRate,
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
            console.warn(`Insights unavailable for media ${item.id}:`, insightsErr)
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
          partial: isRateLimited,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } catch (syncErr) {
      console.error('Sync loop error:', syncErr)

      // Roll back to error status
      await supabase
        .from('instagram_accounts')
        .update({
          sync_status: 'error',
          sync_error:
            syncErr instanceof Error ? syncErr.message : 'Unknown sync error',
        })
        .eq('id', account.id)

      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            error_message:
              syncErr instanceof Error ? syncErr.message : 'Unknown sync error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      return new Response(
        JSON.stringify({ error: 'Sync failed', details: String(syncErr) }),
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
