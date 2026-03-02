import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { withRetry, RateLimitError } from '../_shared/retry.ts'
import { resolveCallerAuth } from '../_shared/caller-auth.ts'
import { mapInstagramInsightsToDb } from '../_shared/instagram-insights-mapper.ts'
import { isMissingRelationError, readLegacyTokenFromAccountRow } from '../_shared/token-store.ts'
import {
  mapAccountMetricsToFacts,
  mapSnapshotMetricsToFacts,
  normalizeFetchDate,
  type IGInsightMetric,
  type MetricFactRow,
} from '../_shared/metric-facts.ts'

// ─── Environment ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// ─── Constants ───────────────────────────────────────────────────────────────

const IG_API_BASE = 'https://graph.instagram.com/v22.0'
const FB_GRAPH_API_BASE = 'https://graph.facebook.com/v22.0'
const MEDIA_FIELDS =
  'id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count'
/** Hard cap on posts per sync run; raised to 400 to support up to 360-day windows */
const MAX_POSTS = 400
/** Stop fetching when this many API calls have been made to leave hourly headroom */
const RATE_CAP = 180
const FACTS_ON_CONFLICT =
  'user_id,account_id,scope,entity_id,metric_name,metric_date,period,metric_type,timeframe,breakdown_type,breakdown_value'
const ACCOUNT_TOTAL_VALUE_METRICS =
  'accounts_engaged,follows_and_unfollows,reach,views,total_interactions,reposts,saves,shares,comments,likes,profile_links_taps'
const ACCOUNT_TIME_SERIES_METRICS =
  'reach,views,total_interactions,reposts,saves,shares,comments,likes,profile_links_taps'
const BUSINESS_DISCOVERY_SNAPSHOT_METRICS = [
  'followers_count',
  'follows_count',
  'media_count',
]
const BUSINESS_DISCOVERY_INSIGHTS_METRICS = 'profile_views,website_taps'

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

interface IGMediaInsightsResponse {
  data: Array<{
    name: string
    values: Array<{ value: number; end_time?: string }>
  }>
  error?: { message: string; type: string; code: number }
}

interface IGUserBusinessDiscoveryResponse {
  business_discovery?: {
    id?: string
    username?: string
    name?: string
    profile_picture_url?: string
    followers_count?: number
    follows_count?: number
    media_count?: number
  }
  error?: { message: string; type: string; code: number }
}

interface IGBusinessDiscoveryInsightsResponse {
  data: IGInsightMetric[]
  error?: { message: string; type: string; code: number }
}

interface IGAccountInsightsResponse {
  data: IGInsightMetric[]
  error?: { message: string; type: string; code: number }
}

interface AccountInsightsRequest {
  metricType: 'total_value' | 'time_series'
  metrics: string
}

interface BusinessDiscoveryTargetRow {
  id: string
  target_username: string
}

function metricKeys(
  scope: 'media' | 'account' | 'business_discovery_account' | 'business_discovery_media',
  metricType: 'snapshot' | 'total_value' | 'time_series',
  metricsCsv: string,
): string[] {
  return metricsCsv
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => `${scope}:${metricType}:${name}`)
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
    return [
      'reach',
      'views',
      'ig_reels_video_view_total_time',
      'ig_reels_avg_watch_time',
      'saved',
      'shares',
      'comments',
      'total_interactions',
      'replies',
      'reposts',
      'reels_skip_rate',
      'crossposted_views',
      'facebook_views',
    ].join(',')
  }
  // IMAGE, VIDEO (non-Reel), CAROUSEL_ALBUM
  return [
    'reach',
    'views',
    'saved',
    'shares',
    'comments',
    'total_interactions',
    'replies',
    'reposts',
    'profile_activity',
  ].join(',')
}

function accountInsightsRequests(): AccountInsightsRequest[] {
  return [
    { metricType: 'total_value', metrics: ACCOUNT_TOTAL_VALUE_METRICS },
    { metricType: 'time_series', metrics: ACCOUNT_TIME_SERIES_METRICS },
  ]
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
        scope: 'all',
        api_host: IG_API_BASE.includes('graph.instagram.com') ? 'graph.instagram.com' : 'unknown',
        api_version: 'v22.0',
        metrics_attempted: [],
        metrics_succeeded: [],
        metrics_failed: [],
        metrics_requested_count: 0,
        metrics_succeeded_count: 0,
        metrics_failed_count: 0,
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
    let accountInsightErrors = 0
    let firstAccountInsightError: string | null = null
    let businessDiscoveryErrors = 0
    let firstBusinessDiscoveryError: string | null = null
    let rateLimitEvents = 0
    const attemptedMetricSet = new Set<string>()
    const succeededMetricSet = new Set<string>()
    const failedMetricSet = new Set<string>()
    const cutoff = cutoffDate(periodDays)
    console.log(`Sync period: ${periodDays} days (cutoff: ${cutoff.toISOString()})`)

    function markAttempted(keys: string[]) {
      keys.forEach((key) => attemptedMetricSet.add(key))
    }

    function markSucceeded(keys: string[]) {
      keys.forEach((key) => succeededMetricSet.add(key))
    }

    function markFailed(keys: string[]) {
      keys.forEach((key) => failedMetricSet.add(key))
    }

    async function upsertMetricFacts(rows: MetricFactRow[]): Promise<{ error: string | null }> {
      if (rows.length === 0) return { error: null }
      const { error } = await supabase
        .from('instagram_metric_facts')
        .upsert(rows, { onConflict: FACTS_ON_CONFLICT })
      return { error: error?.message ?? null }
    }

    async function upsertAccountDailyProjection(
      rows: MetricFactRow[],
      metricType: 'total_value' | 'time_series',
    ): Promise<{ error: string | null }> {
      if (rows.length === 0) return { error: null }

      const byDate = new Map<string, {
        account_id: string
        user_id: string
        metric_date: string
        metric_type: string
        timeframe: string
        accounts_engaged: number | null
        reach: number | null
        views: number | null
        total_interactions: number | null
        likes: number | null
        comments: number | null
        shares: number | null
        saves: number | null
        reposts: number | null
        profile_links_taps: number | null
        follows: number | null
        unfollows: number | null
        net_follower_growth: number | null
      }>()

      for (const fact of rows) {
        const key = `${fact.metric_date}|${fact.timeframe}`
        if (!byDate.has(key)) {
          byDate.set(key, {
            account_id: account.id,
            user_id: accountUserId,
            metric_date: fact.metric_date,
            metric_type: metricType,
            timeframe: fact.timeframe,
            accounts_engaged: null,
            reach: null,
            views: null,
            total_interactions: null,
            likes: null,
            comments: null,
            shares: null,
            saves: null,
            reposts: null,
            profile_links_taps: null,
            follows: null,
            unfollows: null,
            net_follower_growth: null,
          })
        }

        const row = byDate.get(key)!
        const numericValue = fact.metric_value_numeric
        switch (fact.metric_name) {
          case 'accounts_engaged':
            row.accounts_engaged = numericValue
            break
          case 'reach':
            row.reach = numericValue
            break
          case 'views':
            row.views = numericValue
            break
          case 'total_interactions':
            row.total_interactions = numericValue
            break
          case 'likes':
            row.likes = numericValue
            break
          case 'comments':
            row.comments = numericValue
            break
          case 'shares':
            row.shares = numericValue
            break
          case 'saves':
            row.saves = numericValue
            break
          case 'reposts':
            row.reposts = numericValue
            break
          case 'profile_links_taps':
            row.profile_links_taps = numericValue
            break
          case 'follows_and_unfollows':
            if (fact.metric_value_jsonb && typeof fact.metric_value_jsonb === 'object') {
              const followsValue = Number((fact.metric_value_jsonb as Record<string, unknown>).follows ?? 0)
              const unfollowsValue = Number((fact.metric_value_jsonb as Record<string, unknown>).unfollows ?? 0)
              row.follows = Number.isFinite(followsValue) ? followsValue : 0
              row.unfollows = Number.isFinite(unfollowsValue) ? unfollowsValue : 0
              row.net_follower_growth = (row.follows ?? 0) - (row.unfollows ?? 0)
            }
            break
        }
      }

      const { error } = await supabase
        .from('instagram_account_insights_daily')
        .upsert([...byDate.values()], {
          onConflict: 'account_id,metric_date,metric_type,timeframe',
        })

      return { error: error?.message ?? null }
    }

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
                media_product_type: item.media_product_type ?? null,
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
            const mediaMetricKeys = metricKeys('media', 'snapshot', fields)
            mediaMetricKeys.push('media:snapshot:likes')
            markAttempted(mediaMetricKeys)
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
            const insightsBody = (await insightsRes.json()) as IGMediaInsightsResponse

            // Some posts return a top-level error instead of data.
            // Log code + message so we can diagnose metric name issues.
            if (insightsBody.error) {
              const errMsg = `[code ${insightsBody.error.code}] ${insightsBody.error.message}`
              console.warn(`Insights API error for ${item.id}: ${errMsg}`)
              insightErrors++
              if (!firstInsightError) firstInsightError = errMsg
              markFailed(mediaMetricKeys)
              postsProcessed++
              continue
            }

            const insightsData = insightsBody.data ?? []
            const mappedInsights = mapInstagramInsightsToDb({
              insightsData,
              mediaType: item.media_type,
              isReel,
              likeCount: item.like_count ?? 0,
              durationSeconds: null,
            })

            // Snapshots are stored with fetch date as metric_date.
            const fetchedAtIso = new Date().toISOString()
            const fetchDate = normalizeFetchDate(fetchedAtIso)
            const mediaFacts = mapSnapshotMetricsToFacts({
              userId: accountUserId,
              accountId: account.id,
              scope: 'media',
              entityId: mediaRow.id,
              metrics: [
                ...insightsData,
                {
                  name: 'likes',
                  period: 'lifetime',
                  values: [{ value: item.like_count ?? 0 }],
                },
              ],
              fetchDate,
              fetchedAtIso,
              metricType: 'snapshot',
            })
            const metricFactsResult = await upsertMetricFacts(mediaFacts)

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

            if (upsertErr || metricFactsResult.error) {
              console.error(`Insights upsert failed for ${item.id}:`, upsertErr)
              if (metricFactsResult.error) {
                console.error(`Metric facts upsert failed for ${item.id}: ${metricFactsResult.error}`)
              }
              markFailed(mediaMetricKeys)
            } else {
              postsUpserted++
              markSucceeded(mediaMetricKeys)
            }
          } catch (insightsErr) {
            // Some posts (very old or incompatible) don't support insights.
            // Log and continue — never fail the whole sync for one post.
            const fallbackMetrics = insightFields(item.media_type, isReel)
            const fallbackMetricKeys = metricKeys('media', 'snapshot', fallbackMetrics)
            fallbackMetricKeys.push('media:snapshot:likes')
            markAttempted(fallbackMetricKeys)
            if (insightsErr instanceof RateLimitError) {
              console.error('Rate limit exhausted during insights fetch')
              isRateLimited = true
              rateLimitEvents++
              markFailed(fallbackMetricKeys)
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
            markFailed(fallbackMetricKeys)
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

      // ── 10. Fetch account-level insights and persist daily facts ──────────
      if (!isRateLimited) {
        for (const request of accountInsightsRequests()) {
          const accountMetricKeys = metricKeys('account', request.metricType, request.metrics)
          markAttempted(accountMetricKeys)

          try {
            const accountInsightsUrl = new URL(`${IG_API_BASE}/${account.instagram_user_id}/insights`)
            accountInsightsUrl.searchParams.set('metric', request.metrics)
            accountInsightsUrl.searchParams.set('period', 'day')
            accountInsightsUrl.searchParams.set('metric_type', request.metricType)
            accountInsightsUrl.searchParams.set('access_token', accessToken)

            const accountInsightsRes = await withRetry(() =>
              fetch(accountInsightsUrl.toString()).then((r) => {
                callCount++
                if (!r.ok) throw r
                return r
              })
            )

            const accountInsightsBody = (await accountInsightsRes.json()) as IGAccountInsightsResponse
            if (accountInsightsBody.error) {
              const errMsg = `[code ${accountInsightsBody.error.code}] ${accountInsightsBody.error.message}`
              console.warn(`Account insights API error (${request.metricType}): ${errMsg}`)
              accountInsightErrors++
              if (!firstAccountInsightError) firstAccountInsightError = errMsg
              markFailed(accountMetricKeys)
              continue
            }

            const fetchedAtIso = new Date().toISOString()
            const fetchDate = normalizeFetchDate(fetchedAtIso)
            const accountFacts = mapAccountMetricsToFacts({
              userId: accountUserId,
              accountId: account.id,
              scope: 'account',
              entityId: account.id,
              metrics: accountInsightsBody.data ?? [],
              fetchDate,
              fetchedAtIso,
              metricSeriesType: request.metricType,
              metricType: request.metricType,
            })
            const factsResult = await upsertMetricFacts(accountFacts)
            if (factsResult.error) {
              console.error(`Account metric facts upsert failed (${request.metricType}): ${factsResult.error}`)
              accountInsightErrors++
              if (!firstAccountInsightError) firstAccountInsightError = factsResult.error
              markFailed(accountMetricKeys)
              continue
            }

            const projectionResult = await upsertAccountDailyProjection(
              accountFacts,
              request.metricType,
            )
            if (projectionResult.error) {
              console.error(`Account daily projection upsert failed (${request.metricType}): ${projectionResult.error}`)
              accountInsightErrors++
              if (!firstAccountInsightError) firstAccountInsightError = projectionResult.error
            }

            const succeededAccountMetricKeys = new Set(
              accountFacts.map((fact) => `account:${request.metricType}:${fact.metric_name}`),
            )
            markSucceeded([...succeededAccountMetricKeys])
          } catch (accountInsightsErr) {
            if (accountInsightsErr instanceof RateLimitError) {
              console.error('Rate limit exhausted during account insights fetch')
              isRateLimited = true
              rateLimitEvents++
              markFailed(accountMetricKeys)
              break
            }

            let errStr: string
            if (accountInsightsErr instanceof Response) {
              errStr = `HTTP ${accountInsightsErr.status}`
              try {
                const body = await accountInsightsErr.clone().json() as {
                  error?: { message?: string; code?: number }
                }
                if (body.error?.message) {
                  errStr = body.error.code
                    ? `[${body.error.code}] ${body.error.message}`
                    : body.error.message
                }
              } catch { /* keep HTTP status message */ }
            } else if (accountInsightsErr instanceof Error) {
              errStr = accountInsightsErr.message
            } else {
              errStr = String(accountInsightsErr)
            }

            console.warn(`Account insights unavailable (${request.metricType}): ${errStr}`)
            accountInsightErrors++
            if (!firstAccountInsightError) firstAccountInsightError = errStr
            markFailed(accountMetricKeys)
          }
        }
      }

      // ── 11. Sync Business Discovery tracked targets (FB Login token path) ─
      if (!isRateLimited) {
        const { data: bdTargets, error: bdTargetsError } = await supabase
          .from('instagram_business_discovery_targets')
          .select('id,target_username')
          .eq('account_id', account.id)
          .eq('user_id', accountUserId)
          .eq('is_active', true)

        if (bdTargetsError) {
          businessDiscoveryErrors++
          if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = bdTargetsError.message
          console.error('Failed to fetch business discovery targets:', bdTargetsError)
        } else {
          const targets = (bdTargets ?? []) as BusinessDiscoveryTargetRow[]
          for (const target of targets) {
            const targetMetricKeys = metricKeys(
              'business_discovery_account',
              'snapshot',
              `${BUSINESS_DISCOVERY_SNAPSHOT_METRICS.join(',')},${BUSINESS_DISCOVERY_INSIGHTS_METRICS}`,
            )
            markAttempted(targetMetricKeys)

            const { data: fbTokenRow, error: fbTokenError } = await supabase
              .from('instagram_account_fb_tokens')
              .select('access_token_enc')
              .eq('account_id', account.id)
              .eq('user_id', accountUserId)
              .maybeSingle()

            if (fbTokenError || !fbTokenRow?.access_token_enc) {
              businessDiscoveryErrors++
              const details = fbTokenError?.message ?? 'Missing Facebook token row'
              if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = details
              console.warn(`Skipping business discovery for ${target.target_username}: ${details}`)
              markFailed(targetMetricKeys)
              continue
            }

            let fbAccessToken: string
            try {
              fbAccessToken = await decryptToken(fbTokenRow.access_token_enc, TOKEN_ENCRYPTION_KEY)
            } catch {
              businessDiscoveryErrors++
              if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = 'Failed to decrypt Facebook token'
              markFailed(targetMetricKeys)
              continue
            }

            try {
              const discoveryUrl = new URL(`${FB_GRAPH_API_BASE}/${account.instagram_user_id}`)
              discoveryUrl.searchParams.set(
                'fields',
                `business_discovery.username(${target.target_username}){id,username,name,profile_picture_url,followers_count,follows_count,media_count}`,
              )
              discoveryUrl.searchParams.set('access_token', fbAccessToken)

              const discoveryRes = await withRetry(() =>
                fetch(discoveryUrl.toString()).then((r) => {
                  callCount++
                  if (!r.ok) throw r
                  return r
                })
              )
              const discoveryBody = (await discoveryRes.json()) as IGUserBusinessDiscoveryResponse
              if (discoveryBody.error || !discoveryBody.business_discovery) {
                const message = discoveryBody.error?.message ?? 'Business discovery payload missing'
                businessDiscoveryErrors++
                if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = message
                console.warn(`Business discovery unavailable for ${target.target_username}: ${message}`)
                markFailed(targetMetricKeys)
                continue
              }

              const discovered = discoveryBody.business_discovery
              const fetchedAtIso = new Date().toISOString()
              const fetchDate = normalizeFetchDate(fetchedAtIso)

              const { error: profileUpsertError } = await supabase
                .from('instagram_business_discovery_profiles')
                .upsert(
                  {
                    target_id: target.id,
                    account_id: account.id,
                    user_id: accountUserId,
                    ig_user_id: discovered.id ?? null,
                    username: discovered.username ?? target.target_username,
                    name: discovered.name ?? null,
                    profile_picture_url: discovered.profile_picture_url ?? null,
                    followers_count: discovered.followers_count ?? null,
                    follows_count: discovered.follows_count ?? null,
                    media_count: discovered.media_count ?? null,
                    last_seen_at: fetchedAtIso,
                    updated_at: fetchedAtIso,
                  },
                  { onConflict: 'target_id' },
                )

              if (profileUpsertError) {
                businessDiscoveryErrors++
                if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = profileUpsertError.message
                markFailed(targetMetricKeys)
                continue
              }

              let profileViews: number | null = null
              let websiteTaps: number | null = null
              const bdInsightsUrl = new URL(`${FB_GRAPH_API_BASE}/${account.instagram_user_id}/business_discovery_insights`)
              bdInsightsUrl.searchParams.set('metric', BUSINESS_DISCOVERY_INSIGHTS_METRICS)
              bdInsightsUrl.searchParams.set('period', 'day')
              bdInsightsUrl.searchParams.set('target_username', target.target_username)
              bdInsightsUrl.searchParams.set('access_token', fbAccessToken)

              try {
                const bdInsightsRes = await withRetry(() =>
                  fetch(bdInsightsUrl.toString()).then((r) => {
                    callCount++
                    if (!r.ok) throw r
                    return r
                  })
                )
                const bdInsightsBody = (await bdInsightsRes.json()) as IGBusinessDiscoveryInsightsResponse
                const bdInsightsData = bdInsightsBody.data ?? []
                for (const metric of bdInsightsData) {
                  const value = metric.values?.[0]?.value
                  if (metric.name === 'profile_views' && typeof value === 'number') profileViews = value
                  if (metric.name === 'website_taps' && typeof value === 'number') websiteTaps = value
                }
              } catch (bdInsightsErr) {
                // Keep snapshot ingestion running even if optional insights fail.
                let errStr = 'Business discovery insights unavailable'
                if (bdInsightsErr instanceof Error) errStr = bdInsightsErr.message
                else if (bdInsightsErr instanceof Response) errStr = `HTTP ${bdInsightsErr.status}`
                console.warn(`Business discovery insights warning (${target.target_username}): ${errStr}`)
              }

              const { error: dailyUpsertError } = await supabase
                .from('instagram_business_discovery_daily')
                .upsert(
                  {
                    target_id: target.id,
                    account_id: account.id,
                    user_id: accountUserId,
                    snapshot_date: fetchDate,
                    followers_count: discovered.followers_count ?? null,
                    follows_count: discovered.follows_count ?? null,
                    media_count: discovered.media_count ?? null,
                    profile_views: profileViews,
                    website_taps: websiteTaps,
                    captured_at: fetchedAtIso,
                  },
                  { onConflict: 'target_id,snapshot_date' },
                )

              if (dailyUpsertError) {
                businessDiscoveryErrors++
                if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = dailyUpsertError.message
                markFailed(targetMetricKeys)
                continue
              }

              const bdMetrics: IGInsightMetric[] = [
                { name: 'followers_count', period: 'day', values: [{ value: discovered.followers_count ?? 0 }] },
                { name: 'follows_count', period: 'day', values: [{ value: discovered.follows_count ?? 0 }] },
                { name: 'media_count', period: 'day', values: [{ value: discovered.media_count ?? 0 }] },
                { name: 'profile_views', period: 'day', values: [{ value: profileViews ?? 0 }] },
                { name: 'website_taps', period: 'day', values: [{ value: websiteTaps ?? 0 }] },
              ]
              const bdFacts = mapSnapshotMetricsToFacts({
                userId: accountUserId,
                accountId: account.id,
                scope: 'business_discovery_account',
                entityId: target.id,
                metrics: bdMetrics,
                fetchDate,
                fetchedAtIso,
                metricType: 'snapshot',
              })

              const bdFactsResult = await upsertMetricFacts(bdFacts)
              if (bdFactsResult.error) {
                businessDiscoveryErrors++
                if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = bdFactsResult.error
                markFailed(targetMetricKeys)
                continue
              }

              markSucceeded(targetMetricKeys)
            } catch (bdErr) {
              if (bdErr instanceof RateLimitError) {
                console.error('Rate limit exhausted during business discovery fetch')
                isRateLimited = true
                rateLimitEvents++
              }
              businessDiscoveryErrors++
              const message = bdErr instanceof Error ? bdErr.message : String(bdErr)
              if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = message
              markFailed(targetMetricKeys)
            }
          }
        }
      }

      // ── 12. Update account status ──────────────────────────────────────────
      const finalStatus = isRateLimited ? 'partial' : 'complete'
      const attemptedMetrics = [...attemptedMetricSet].sort()
      const succeededMetrics = [...succeededMetricSet].sort()
      const failedMetrics = [...failedMetricSet]
        .filter((metricKey) => !succeededMetricSet.has(metricKey))
        .sort()
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
            scope: 'all',
            api_host: rateLimitEvents > 0 || businessDiscoveryErrors > 0 ? 'graph.instagram.com|graph.facebook.com' : 'graph.instagram.com',
            api_version: 'v22.0',
            rate_limit_events: rateLimitEvents,
            failure_class: isRateLimited ? 'rate_limit' : null,
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            metrics_attempted: attemptedMetrics,
            metrics_succeeded: succeededMetrics,
            metrics_failed: failedMetrics,
            metrics_requested_count: attemptedMetrics.length,
            metrics_succeeded_count: succeededMetrics.length,
            metrics_failed_count: failedMetrics.length,
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
          accountInsightErrors,
          firstAccountInsightError,
          businessDiscoveryErrors,
          firstBusinessDiscoveryError,
          metricsAttempted: attemptedMetrics,
          metricsSucceeded: succeededMetrics,
          metricsFailed: failedMetrics,
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
        const attemptedMetrics = [...attemptedMetricSet].sort()
        const succeededMetrics = [...succeededMetricSet].sort()
        const failedMetrics = [...failedMetricSet]
          .filter((metricKey) => !succeededMetricSet.has(metricKey))
          .sort()

        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            scope: 'all',
            api_host: 'graph.instagram.com|graph.facebook.com',
            api_version: 'v22.0',
            rate_limit_events: rateLimitEvents,
            failure_class: 'provider',
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            metrics_attempted: attemptedMetrics,
            metrics_succeeded: succeededMetrics,
            metrics_failed: failedMetrics,
            metrics_requested_count: attemptedMetrics.length,
            metrics_succeeded_count: succeededMetrics.length,
            metrics_failed_count: failedMetrics.length,
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
