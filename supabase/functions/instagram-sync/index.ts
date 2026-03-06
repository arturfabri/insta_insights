import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { withRetry, RateLimitError } from '../_shared/retry.ts'
import { resolveCallerAuth } from '../_shared/caller-auth.ts'
import { mapInstagramInsightsToDb } from '../_shared/instagram-insights-mapper.ts'
import {
  isInvalidMetricError,
  type IGMediaInsightsResponse,
} from '../_shared/media-insights-fetch.ts'
import { isMissingRelationError, readLegacyTokenFromAccountRow } from '../_shared/token-store.ts'
import { buildProviderErrorDiagnostics } from '../_shared/provider-error-diagnostics.ts'
import {
  mapAccountMetricsToFacts,
  mapSnapshotMetricsToFacts,
  normalizeFetchDate,
  type IGInsightMetric,
  type MetricFactRow,
} from '../_shared/metric-facts.ts'
import {
  buildSyncCapabilityMatrix,
  classifyReturnedMetrics,
  getAccountMetricBundles,
  getMediaMetricBundles,
  resolveSyncWindow,
  type SyncPeriodDays,
} from '../_shared/sync-metric-capabilities.ts'
import {
  projectAccountFactsToDailyRows,
} from '../_shared/account-insights-daily-projection.ts'

// ─── Environment ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// ─── Constants ───────────────────────────────────────────────────────────────

const IG_API_BASE = 'https://graph.instagram.com/v25.0'
const FB_GRAPH_API_BASE = 'https://graph.facebook.com/v25.0'
const MEDIA_FIELDS =
  'id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count'
/** Hard cap on posts per sync run; raised to 400 to support up to 360-day windows */
const MAX_POSTS = 400
/** Stop fetching when this many API calls have been made to leave hourly headroom */
const RATE_CAP = 180
const FACTS_ON_CONFLICT =
  'user_id,account_id,scope,entity_id,metric_name,metric_date,period,metric_type,timeframe,breakdown_type,breakdown_value'
const BUSINESS_DISCOVERY_SNAPSHOT_METRICS = [
  'followers_count',
  'follows_count',
  'media_count',
]
const BUSINESS_DISCOVERY_INSIGHTS_METRICS = 'profile_views,website_taps'

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

interface BusinessDiscoveryTargetRow {
  id: string
  target_username: string
}

interface InstagramAccountRow {
  id: string
  user_id: string
  instagram_user_id: string
  username: string
  sync_status: string | null
  updated_at: string
  [key: string]: unknown
}

interface SyncScopesRequest {
  media: boolean
  account: boolean
  businessDiscovery: boolean
}

function normalizeSyncScopes(syncScopes: {
  media?: boolean
  account?: boolean
  businessDiscovery?: boolean
} | undefined): SyncScopesRequest {
  return {
    media: syncScopes?.media ?? true,
    account: syncScopes?.account ?? true,
    businessDiscovery: syncScopes?.businessDiscovery ?? true,
  }
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
      syncMode?: 'standard' | 'backfill'
      backfillDays?: number
      syncScopes?: {
        media?: boolean
        account?: boolean
        businessDiscovery?: boolean
      }
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

    const syncWindow = resolveSyncWindow({
      syncMode: body.syncMode,
      syncPeriodDays: body.syncPeriodDays,
      backfillDays: body.backfillDays,
    })
    const periodDays: SyncPeriodDays = syncWindow.periodDays
    const syncMode = syncWindow.mode
    const requestedScopes = normalizeSyncScopes(body.syncScopes)

    // ── 3. Fetch account ─────────────────────────────────────────────────────
    let account: InstagramAccountRow | null = null
    let accountError: { message?: string } | null = null

    if (caller.kind === 'user') {
      if (body.accountId) {
        const result = await supabase
          .from('instagram_accounts')
          .select('*')
          .eq('user_id', caller.userId)
          .eq('id', body.accountId)
          .maybeSingle()
        account = result.data
        accountError = result.error
      } else {
        const result = await supabase
          .from('instagram_accounts')
          .select('*')
          .eq('user_id', caller.userId)
          .order('created_at', { ascending: true })
          .limit(2)

        if (result.error) {
          accountError = result.error
        } else if ((result.data?.length ?? 0) > 1) {
          return new Response(
            JSON.stringify({
              error: 'Multiple Instagram accounts are linked to this user. Resolve duplicates before syncing.',
            }),
            {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } else {
          account = result.data?.[0] ?? null
        }
      }
    } else {
      if (!body.accountId) {
        return new Response(JSON.stringify({ error: 'accountId is required for cron sync' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const result = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('id', body.accountId)
        .maybeSingle()
      account = result.data
      accountError = result.error
    }

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

    const { data: fbTokenRow, error: fbTokenError } = await supabase
      .from('instagram_account_fb_tokens')
      .select('access_token_enc,token_expires_at')
      .eq('account_id', account.id)
      .eq('user_id', accountUserId)
      .maybeSingle()

    let encryptedToken = fbTokenRow?.access_token_enc ?? tokenRow?.access_token_enc ?? null
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
      const details =
        fbTokenError?.message ??
        tokenError?.message ??
        'Token row missing and legacy token unavailable'
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

    let businessAccessToken: string | null = null
    if (fbTokenRow?.access_token_enc) {
      try {
        businessAccessToken =
          fbTokenRow.access_token_enc === encryptedToken
            ? accessToken
            : await decryptToken(fbTokenRow.access_token_enc, TOKEN_ENCRYPTION_KEY)
      } catch {
        console.warn(`Failed to decrypt Business Login token for account ${account.id}`)
      }
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
        api_version: 'v25.0',
        metrics_attempted: [],
        metrics_succeeded: [],
        metrics_failed: [],
        metrics_requested_count: 0,
        metrics_succeeded_count: 0,
        metrics_failed_count: 0,
        capability_gaps: [],
        provider_error_text: null,
        provider_error_details: {},
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
    const capabilityGapSet = new Set<string>()
    const disabledMediaAdvancedGroups = new Set<'media_advanced_reel' | 'media_advanced_standard'>()
    const disabledAccountAdvancedBundles = new Set<string>()
    let canRunBusinessDiscovery = requestedScopes.businessDiscovery
    const cutoff = cutoffDate(periodDays)
    console.log(
      `Sync window mode=${syncMode} source=${syncWindow.source} period=${periodDays} days (cutoff: ${cutoff.toISOString()})`,
    )

    function markAttempted(keys: string[]) {
      keys.forEach((key) => attemptedMetricSet.add(key))
    }

    function markSucceeded(keys: string[]) {
      keys.forEach((key) => succeededMetricSet.add(key))
    }

    function markFailed(keys: string[]) {
      keys.forEach((key) => failedMetricSet.add(key))
    }

    function markCapabilityGap(gap: string) {
      capabilityGapSet.add(gap)
    }

    if (requestedScopes.businessDiscovery) {
      const { data: capabilityRow, error: capabilityError } = await supabase
        .from('instagram_account_capabilities')
        .select('facebook_connected,business_discovery_enabled,facebook_token_expires_at')
        .eq('account_id', account.id)
        .eq('user_id', accountUserId)
        .maybeSingle()

      if (capabilityError && !isMissingRelationError(capabilityError)) {
        console.error(`Capability lookup failed for account ${account.id}: ${capabilityError.message}`)
        canRunBusinessDiscovery = false
        markCapabilityGap('business_discovery:capability_lookup_failed')
      } else if (capabilityRow) {
        const expiresAtMs = capabilityRow.facebook_token_expires_at
          ? new Date(capabilityRow.facebook_token_expires_at).getTime()
          : null
        const isExpired = expiresAtMs !== null && expiresAtMs <= Date.now()

        canRunBusinessDiscovery = capabilityRow.facebook_connected &&
          capabilityRow.business_discovery_enabled &&
          !isExpired

        if (!canRunBusinessDiscovery) {
          const reason = isExpired
            ? 'business_discovery:facebook_token_expired'
            : 'business_discovery:facebook_login_missing'
          markCapabilityGap(reason)
        }
      } else {
        if (fbTokenError && !isMissingRelationError(fbTokenError)) {
          console.error(`FB token fallback lookup failed for account ${account.id}: ${fbTokenError.message}`)
        }

        const expiresAtMs = fbTokenRow?.token_expires_at
          ? new Date(fbTokenRow.token_expires_at).getTime()
          : null
        const isExpired = expiresAtMs !== null && expiresAtMs <= Date.now()

        canRunBusinessDiscovery = Boolean(fbTokenRow?.access_token_enc) && !isExpired
        if (!canRunBusinessDiscovery) {
          const reason = isExpired
            ? 'business_discovery:facebook_token_expired'
            : 'business_discovery:facebook_login_missing'
          markCapabilityGap(reason)
        }

        const nowIso = new Date().toISOString()
        const { error: capabilityUpsertError } = await supabase
          .from('instagram_account_capabilities')
          .upsert(
            {
              account_id: account.id,
              user_id: accountUserId,
              instagram_connected: true,
              facebook_connected: canRunBusinessDiscovery,
              business_discovery_enabled: canRunBusinessDiscovery,
              facebook_token_expires_at: fbTokenRow?.token_expires_at ?? null,
              status_reason: canRunBusinessDiscovery
                ? 'meta_upgraded'
                : isExpired
                ? 'facebook_token_expired'
                : 'facebook_login_missing',
              last_validated_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: 'account_id' },
          )

        if (capabilityUpsertError && !isMissingRelationError(capabilityUpsertError)) {
          console.warn(`Capability fallback upsert failed for ${account.id}: ${capabilityUpsertError.message}`)
        }
      }
    }

    const syncCapabilityMatrix = buildSyncCapabilityMatrix({
      apiHost: IG_API_BASE,
      businessDiscoveryRequested: requestedScopes.businessDiscovery,
      canRunBusinessDiscovery,
    })

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
      const projectionRows = projectAccountFactsToDailyRows(rows, account.id, accountUserId, metricType)

      const { error } = await supabase
        .from('instagram_account_insights_daily')
        .upsert(projectionRows, {
          onConflict: 'account_id,metric_date,metric_type,timeframe',
        })

      return { error: error?.message ?? null }
    }

    async function fetchMediaInsightsPayload(
      mediaId: string,
      metricsCsv: string,
    ): Promise<IGMediaInsightsResponse> {
      const insightsUrl = new URL(`${IG_API_BASE}/${mediaId}/insights`)
      insightsUrl.searchParams.set('metric', metricsCsv)
      insightsUrl.searchParams.set('period', 'lifetime')
      insightsUrl.searchParams.set('access_token', accessToken)

      const insightsRes = await withRetry(() =>
        fetch(insightsUrl.toString()).then((r) => {
          callCount++
          if (r.status === 429) throw r
          return r
        }),
      )

      const insightsBody = (await insightsRes.json()) as IGMediaInsightsResponse
      if (!insightsRes.ok && !insightsBody.error) {
        throw new Error(`Insights request failed (HTTP ${insightsRes.status})`)
      }
      return insightsBody
    }

    async function fetchAccountInsightsPayload(
      metricsCsv: string,
      metricType: 'total_value' | 'time_series',
      period: 'day' | 'lifetime',
      timeframe?: string,
      breakdown?: string,
    ): Promise<IGAccountInsightsResponse> {
      const accountApiBase = businessAccessToken ? FB_GRAPH_API_BASE : IG_API_BASE
      const accountInsightsToken = businessAccessToken ?? accessToken
      const accountInsightsUrl = new URL(`${accountApiBase}/${account.instagram_user_id}/insights`)
      accountInsightsUrl.searchParams.set('metric', metricsCsv)
      accountInsightsUrl.searchParams.set('period', period)
      accountInsightsUrl.searchParams.set('metric_type', metricType)
      if (timeframe) accountInsightsUrl.searchParams.set('timeframe', timeframe)
      if (breakdown) accountInsightsUrl.searchParams.set('breakdown', breakdown)
      accountInsightsUrl.searchParams.set('access_token', accountInsightsToken)

      const accountInsightsRes = await withRetry(() =>
        fetch(accountInsightsUrl.toString()).then((r) => {
          callCount++
          if (r.status === 429) throw r
          return r
        }),
      )

      const accountInsightsBody = (await accountInsightsRes.json()) as IGAccountInsightsResponse
      if (!accountInsightsRes.ok && !accountInsightsBody.error) {
        throw new Error(`Account insights request failed (HTTP ${accountInsightsRes.status})`)
      }
      return accountInsightsBody
    }

    function expandAccountBundleRequests(bundle: ReturnType<typeof getAccountMetricBundles>[number]) {
      const timeframes = bundle.timeframes?.length ? bundle.timeframes : [undefined]
      const breakdowns = bundle.breakdowns?.length ? bundle.breakdowns : [undefined]
      return timeframes.flatMap((timeframe) =>
        breakdowns.map((breakdown) => ({ timeframe, breakdown })),
      )
    }

    try {
      if (requestedScopes.media) {
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
          const mediaBundles = getMediaMetricBundles(isReel, syncCapabilityMatrix)
          const coreMetricKeys = metricKeys('media', 'snapshot', mediaBundles.coreMetricsCsv)
          const likesMetricKey = 'media:snapshot:likes'
          const mediaCoreAttemptKeys = [...coreMetricKeys, likesMetricKey]
          markAttempted(mediaCoreAttemptKeys)

          try {
            const corePayload = await fetchMediaInsightsPayload(item.id, mediaBundles.coreMetricsCsv)
            if (corePayload.error) {
              const errMsg = `[code ${corePayload.error.code}] ${corePayload.error.message}`
              console.warn(`Core insights API error for ${item.id}: ${errMsg}`)
              insightErrors++
              if (!firstInsightError) firstInsightError = errMsg
              markFailed(mediaCoreAttemptKeys)
              postsProcessed++
              continue
            }

            const coreInsightsData = corePayload.data ?? []
            const coreCoverage = classifyReturnedMetrics(
              mediaBundles.coreMetricsCsv,
              coreInsightsData.map((metric) => metric.name),
            )
            if (coreCoverage.present.length === 0) {
              const errMsg = `Core insights payload empty for media ${item.id}`
              console.warn(errMsg)
              insightErrors++
              if (!firstInsightError) firstInsightError = errMsg
              markFailed(mediaCoreAttemptKeys)
              postsProcessed++
              continue
            }

            markSucceeded([
              ...coreCoverage.present.map((metric) => `media:snapshot:${metric}`),
              likesMetricKey,
            ])
            if (coreCoverage.missing.length > 0) {
              markFailed(coreCoverage.missing.map((metric) => `media:snapshot:${metric}`))
              markCapabilityGap(`media:core:partial:${isReel ? 'reel' : 'standard'}`)
            }

            let combinedInsightsData = [...coreInsightsData]

            const canRequestAdvanced = mediaBundles.advancedMetricsCsv !== null &&
              mediaBundles.advancedGroupId !== null &&
              !disabledMediaAdvancedGroups.has(mediaBundles.advancedGroupId)

            if (canRequestAdvanced && mediaBundles.advancedMetricsCsv && mediaBundles.advancedGroupId) {
              const advancedMetricKeys = metricKeys('media', 'snapshot', mediaBundles.advancedMetricsCsv)
              markAttempted(advancedMetricKeys)

              try {
                const advancedPayload = await fetchMediaInsightsPayload(item.id, mediaBundles.advancedMetricsCsv)
                if (advancedPayload.error) {
                  const advancedErr = `[code ${advancedPayload.error.code}] ${advancedPayload.error.message}`
                  if (isInvalidMetricError(advancedPayload.error)) {
                    disabledMediaAdvancedGroups.add(mediaBundles.advancedGroupId)
                    markCapabilityGap(`media:${mediaBundles.advancedGroupId}:unsupported`)
                    console.warn(`Advanced media metrics unsupported (${mediaBundles.advancedGroupId}): ${advancedErr}`)
                  } else {
                    insightErrors++
                    if (!firstInsightError) firstInsightError = advancedErr
                    console.warn(`Advanced media metrics failed (${mediaBundles.advancedGroupId}): ${advancedErr}`)
                  }
                  markFailed(advancedMetricKeys)
                } else {
                  const advancedInsightsData = advancedPayload.data ?? []
                  const advancedCoverage = classifyReturnedMetrics(
                    mediaBundles.advancedMetricsCsv,
                    advancedInsightsData.map((metric) => metric.name),
                  )
                  markSucceeded(
                    advancedCoverage.present.map((metric) => `media:snapshot:${metric}`),
                  )
                  if (advancedCoverage.missing.length > 0) {
                    markFailed(advancedCoverage.missing.map((metric) => `media:snapshot:${metric}`))
                    markCapabilityGap(`media:${mediaBundles.advancedGroupId}:partial`)
                  }
                  combinedInsightsData = [...combinedInsightsData, ...advancedInsightsData]
                }
              } catch (advancedErr) {
                if (advancedErr instanceof RateLimitError) {
                  throw advancedErr
                }
                let errStr = 'Advanced media insights unavailable'
                if (advancedErr instanceof Error) errStr = advancedErr.message
                else if (advancedErr instanceof Response) errStr = `HTTP ${advancedErr.status}`
                markFailed(advancedMetricKeys)
                markCapabilityGap(`media:${mediaBundles.advancedGroupId}:transient_error`)
                console.warn(`Advanced media metrics warning (${mediaBundles.advancedGroupId}): ${errStr}`)
                insightErrors++
                if (!firstInsightError) firstInsightError = errStr
              }
            }

            const mappedInsights = mapInstagramInsightsToDb({
              insightsData: combinedInsightsData,
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
                ...combinedInsightsData,
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
              markFailed(mediaCoreAttemptKeys)
            } else {
              postsUpserted++
            }
          } catch (insightsErr) {
            // Some posts (very old or incompatible) don't support insights.
            // Log and continue — never fail the whole sync for one post.
            if (insightsErr instanceof RateLimitError) {
              console.error('Rate limit exhausted during insights fetch')
              isRateLimited = true
              rateLimitEvents++
              markFailed(mediaCoreAttemptKeys)
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
            markFailed(mediaCoreAttemptKeys)
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
      }

      // ── 10. Fetch account-level insights and persist daily facts ──────────
      if (!isRateLimited && requestedScopes.account) {
        const accountMetricBundles = getAccountMetricBundles(syncCapabilityMatrix)
        for (const bundle of accountMetricBundles) {
          if (!bundle.core && disabledAccountAdvancedBundles.has(bundle.id)) continue

          const accountMetricKeys = metricKeys('account', bundle.metricType, bundle.metricsCsv)
          markAttempted(accountMetricKeys)
          const requestVariants = expandAccountBundleRequests(bundle)

          for (const requestVariant of requestVariants) {
            try {
              const accountInsightsBody = await fetchAccountInsightsPayload(
                bundle.metricsCsv,
                bundle.metricType,
                bundle.period,
                requestVariant.timeframe,
                requestVariant.breakdown,
              )
              if (accountInsightsBody.error) {
                const errMsg = `[code ${accountInsightsBody.error.code}] ${accountInsightsBody.error.message}`
                if (!bundle.core && isInvalidMetricError(accountInsightsBody.error)) {
                  disabledAccountAdvancedBundles.add(bundle.id)
                  markCapabilityGap(`account:${bundle.id}:unsupported`)
                  console.warn(`Account advanced metrics unsupported (${bundle.id}): ${errMsg}`)
                } else if (bundle.projectionTarget === 'facts_only') {
                  markCapabilityGap(`account:${bundle.id}:unavailable`)
                  console.warn(`Optional account insights unavailable (${bundle.id}): ${errMsg}`)
                } else {
                  accountInsightErrors++
                  if (!firstAccountInsightError) firstAccountInsightError = errMsg
                  console.warn(`Account insights API error (${bundle.id}): ${errMsg}`)
                }
                markFailed(accountMetricKeys)
                continue
              }

              const returnedMetrics = accountInsightsBody.data ?? []
              const coverage = classifyReturnedMetrics(
                bundle.metricsCsv,
                returnedMetrics.map((metric) => metric.name),
              )
              const succeededBundleKeys = coverage.present.map(
                (metric) => `account:${bundle.metricType}:${metric}`,
              )
              const missingBundleKeys = coverage.missing.map(
                (metric) => `account:${bundle.metricType}:${metric}`,
              )

              if (succeededBundleKeys.length === 0) {
                if (!bundle.core) {
                  disabledAccountAdvancedBundles.add(bundle.id)
                  markCapabilityGap(`account:${bundle.id}:empty`)
                } else if (bundle.projectionTarget === 'facts_only') {
                  markCapabilityGap(`account:${bundle.id}:empty`)
                } else {
                  accountInsightErrors++
                  if (!firstAccountInsightError) {
                    firstAccountInsightError = `No account metrics returned for ${bundle.id}`
                  }
                }
                markFailed(accountMetricKeys)
                continue
              }

              markSucceeded(succeededBundleKeys)
              if (missingBundleKeys.length > 0) {
                markFailed(missingBundleKeys)
                markCapabilityGap(`account:${bundle.id}:partial`)
              }

              const fetchedAtIso = new Date().toISOString()
              const fetchDate = normalizeFetchDate(fetchedAtIso)
              const accountFacts = mapAccountMetricsToFacts({
                userId: accountUserId,
                accountId: account.id,
                scope: 'account',
                entityId: account.id,
                metrics: returnedMetrics,
                fetchDate,
                fetchedAtIso,
                metricSeriesType: bundle.metricType,
                metricType: bundle.metricType,
                timeframe: requestVariant.timeframe,
                breakdownType: requestVariant.breakdown,
              })
              const factsResult = await upsertMetricFacts(accountFacts)
              if (factsResult.error) {
                console.error(`Account metric facts upsert failed (${bundle.id}): ${factsResult.error}`)
                accountInsightErrors++
                if (!firstAccountInsightError) firstAccountInsightError = factsResult.error
                markFailed(accountMetricKeys)
                continue
              }

              if (bundle.projectionTarget === 'daily') {
                const projectionResult = await upsertAccountDailyProjection(
                  accountFacts,
                  bundle.metricType,
                )
                if (projectionResult.error) {
                  console.error(`Account daily projection upsert failed (${bundle.id}): ${projectionResult.error}`)
                  accountInsightErrors++
                  if (!firstAccountInsightError) firstAccountInsightError = projectionResult.error
                }
              }
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

              console.warn(`Account insights unavailable (${bundle.id}): ${errStr}`)
              if (bundle.projectionTarget === 'facts_only') {
                markCapabilityGap(`account:${bundle.id}:transient_error`)
                markFailed(accountMetricKeys)
                continue
              }

              if (!bundle.core) {
                markCapabilityGap(`account:${bundle.id}:transient_error`)
              }
              accountInsightErrors++
              if (!firstAccountInsightError) firstAccountInsightError = errStr
              markFailed(accountMetricKeys)
            }

            if (isRateLimited) break
          }

          if (isRateLimited) break
        }
      }

      if (!isRateLimited && requestedScopes.businessDiscovery && !canRunBusinessDiscovery) {
        const capabilityMessage =
          'Business discovery skipped: Meta (Facebook Login) connection is missing or expired'
        console.warn(capabilityMessage)
        if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = capabilityMessage
      }

      // ── 11. Sync Business Discovery tracked targets (FB Login token path) ─
      if (!isRateLimited && requestedScopes.businessDiscovery && canRunBusinessDiscovery) {
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

            if (!businessAccessToken) {
              businessDiscoveryErrors++
              const details = fbTokenError?.message ?? 'Missing Business Login token row'
              if (!firstBusinessDiscoveryError) firstBusinessDiscoveryError = details
              console.warn(`Skipping business discovery for ${target.target_username}: ${details}`)
              markFailed(targetMetricKeys)
              continue
            }

            try {
              const discoveryUrl = new URL(`${FB_GRAPH_API_BASE}/${account.instagram_user_id}`)
              discoveryUrl.searchParams.set(
                'fields',
                `business_discovery.username(${target.target_username}){id,username,name,profile_picture_url,followers_count,follows_count,media_count}`,
              )
              discoveryUrl.searchParams.set('access_token', businessAccessToken)

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
              bdInsightsUrl.searchParams.set('access_token', businessAccessToken)

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
      const capabilityGaps = [...capabilityGapSet].sort()
      const isCapabilityPartial = requestedScopes.businessDiscovery &&
        !canRunBusinessDiscovery &&
        capabilityGaps.length > 0
      const isPartial = isRateLimited || isCapabilityPartial
      const finalStatus = isPartial ? 'partial' : 'complete'
      const attemptedMetrics = [...attemptedMetricSet].sort()
      const succeededMetrics = [...succeededMetricSet].sort()
      const failedMetrics = [...failedMetricSet]
        .filter((metricKey) => !succeededMetricSet.has(metricKey))
        .sort()
      const providerDiagnostics = buildProviderErrorDiagnostics({
        media: firstInsightError,
        account: firstAccountInsightError,
        businessDiscovery: firstBusinessDiscoveryError,
      })
      await supabase
        .from('instagram_accounts')
        .update({
          sync_status: finalStatus,
          last_synced_at: new Date().toISOString(),
          sync_error: isRateLimited
            ? 'Rate limit reached — partial sync completed'
            : isCapabilityPartial
            ? 'Business discovery skipped — Meta connection required'
            : null,
        })
        .eq('id', account.id)

      // ── 11. Update sync_log ────────────────────────────────────────────────
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: isPartial ? 'partial' : 'complete',
            scope: 'all',
            api_host: requestedScopes.businessDiscovery
              ? 'graph.instagram.com|graph.facebook.com'
              : 'graph.instagram.com',
            api_version: 'v25.0',
            rate_limit_events: rateLimitEvents,
            failure_class: isRateLimited
              ? 'rate_limit'
              : isCapabilityPartial
              ? 'capability_gap'
              : null,
            posts_fetched: postsProcessed,
            posts_updated: postsUpserted,
            metrics_attempted: attemptedMetrics,
            metrics_succeeded: succeededMetrics,
            metrics_failed: failedMetrics,
            metrics_requested_count: attemptedMetrics.length,
            metrics_succeeded_count: succeededMetrics.length,
            metrics_failed_count: failedMetrics.length,
            capability_gaps: capabilityGaps,
            provider_error_text: providerDiagnostics.providerErrorText,
            provider_error_details: providerDiagnostics.providerErrorDetails,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      // ── 12. Return ─────────────────────────────────────────────────────────
      return new Response(
        JSON.stringify({
          success: true,
          syncMode,
          syncWindowSource: syncWindow.source,
          syncPeriodDays: periodDays,
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
          capabilityGaps,
          partial: isPartial,
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
        const capabilityGaps = [...capabilityGapSet].sort()
        const providerDiagnostics = buildProviderErrorDiagnostics({
          media: firstInsightError,
          account: firstAccountInsightError,
          businessDiscovery: firstBusinessDiscoveryError,
        })

        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            scope: 'all',
            api_host: 'graph.instagram.com|graph.facebook.com',
            api_version: 'v25.0',
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
            capability_gaps: capabilityGaps,
            error_message: errorMessage,
            provider_error_text: providerDiagnostics.providerErrorText,
            provider_error_details: providerDiagnostics.providerErrorDetails,
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
