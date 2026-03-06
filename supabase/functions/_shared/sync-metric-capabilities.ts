export const VALID_SYNC_PERIODS = [90, 180, 360] as const
export type SyncPeriodDays = (typeof VALID_SYNC_PERIODS)[number]

export type SyncMode = 'standard' | 'backfill'

export interface ResolveSyncWindowInput {
  syncMode?: SyncMode
  syncPeriodDays?: number
  backfillDays?: number
}

export interface ResolvedSyncWindow {
  mode: SyncMode
  periodDays: SyncPeriodDays
  source: 'default' | 'sync_period' | 'backfill'
}

export interface CapabilityMatrixInput {
  apiHost: string
  businessDiscoveryRequested: boolean
  canRunBusinessDiscovery: boolean
}

export interface SyncCapabilityMatrix {
  apiHost: 'graph.instagram.com' | 'graph.facebook.com' | 'unknown'
  media: {
    coreEnabled: boolean
    advancedEnabled: boolean
  }
  account: {
    coreEnabled: boolean
    advancedEnabled: boolean
  }
  businessDiscovery: {
    enabled: boolean
  }
}

export interface MediaMetricBundles {
  coreMetricsCsv: string
  advancedMetricsCsv: string | null
  advancedGroupId: 'media_advanced_reel' | 'media_advanced_standard' | null
}

export interface AccountMetricBundle {
  id:
    | 'account_time_series_core'
    | 'account_total_value_core'
    | 'account_time_series_advanced'
    | 'account_total_value_advanced'
  metricType: 'total_value' | 'time_series'
  metricsCsv: string
  core: boolean
}

export const MEDIA_CORE_METRICS_CSV = ['reach', 'views', 'saved', 'shares', 'comments'].join(',')
export const MEDIA_ADVANCED_REEL_METRICS_CSV = [
  'total_interactions',
  'replies',
  'reposts',
  'reels_skip_rate',
  'crossposted_views',
  'facebook_views',
  'ig_reels_video_view_total_time',
  'ig_reels_avg_watch_time',
].join(',')
export const MEDIA_ADVANCED_STANDARD_METRICS_CSV = [
  'total_interactions',
  'replies',
  'reposts',
  'profile_activity',
].join(',')

export const ACCOUNT_TIME_SERIES_CORE_METRICS_CSV = 'reach'
export const ACCOUNT_TOTAL_VALUE_CORE_METRICS_CSV = 'reach'
export const ACCOUNT_TIME_SERIES_ADVANCED_METRICS_CSV = [
  'views',
  'total_interactions',
  'reposts',
  'saves',
  'shares',
  'comments',
  'likes',
  'profile_links_taps',
].join(',')
export const ACCOUNT_TOTAL_VALUE_ADVANCED_METRICS_CSV = [
  'accounts_engaged',
  'follows_and_unfollows',
  'views',
  'total_interactions',
  'reposts',
  'saves',
  'shares',
  'comments',
  'likes',
  'profile_links_taps',
].join(',')

function normalizeApiHost(host: string): 'graph.instagram.com' | 'graph.facebook.com' | 'unknown' {
  if (host.includes('graph.instagram.com')) return 'graph.instagram.com'
  if (host.includes('graph.facebook.com')) return 'graph.facebook.com'
  return 'unknown'
}

export function resolveSyncWindow(input: ResolveSyncWindowInput): ResolvedSyncWindow {
  const mode: SyncMode = input.syncMode === 'backfill' ? 'backfill' : 'standard'
  const syncPeriodIsValid = VALID_SYNC_PERIODS.includes(input.syncPeriodDays as SyncPeriodDays)
  const backfillIsValid = VALID_SYNC_PERIODS.includes(input.backfillDays as SyncPeriodDays)

  if (mode === 'backfill') {
    if (backfillIsValid) {
      return {
        mode,
        periodDays: input.backfillDays as SyncPeriodDays,
        source: 'backfill',
      }
    }
    if (syncPeriodIsValid) {
      return {
        mode,
        periodDays: input.syncPeriodDays as SyncPeriodDays,
        source: 'sync_period',
      }
    }
    return {
      mode,
      periodDays: 90,
      source: 'default',
    }
  }

  if (syncPeriodIsValid) {
    return {
      mode,
      periodDays: input.syncPeriodDays as SyncPeriodDays,
      source: 'sync_period',
    }
  }

  return {
    mode,
    periodDays: 90,
    source: 'default',
  }
}

export function buildSyncCapabilityMatrix(input: CapabilityMatrixInput): SyncCapabilityMatrix {
  const normalizedApiHost = normalizeApiHost(input.apiHost)
  const hasInstagramInsightsPath = normalizedApiHost === 'graph.instagram.com'

  return {
    apiHost: normalizedApiHost,
    media: {
      coreEnabled: hasInstagramInsightsPath,
      advancedEnabled: hasInstagramInsightsPath,
    },
    account: {
      coreEnabled: hasInstagramInsightsPath,
      advancedEnabled: hasInstagramInsightsPath,
    },
    businessDiscovery: {
      enabled: input.businessDiscoveryRequested && input.canRunBusinessDiscovery,
    },
  }
}

export function getMediaMetricBundles(
  isReel: boolean,
  matrix: SyncCapabilityMatrix,
): MediaMetricBundles {
  if (!matrix.media.advancedEnabled) {
    return {
      coreMetricsCsv: MEDIA_CORE_METRICS_CSV,
      advancedMetricsCsv: null,
      advancedGroupId: null,
    }
  }

  return {
    coreMetricsCsv: MEDIA_CORE_METRICS_CSV,
    advancedMetricsCsv: isReel
      ? MEDIA_ADVANCED_REEL_METRICS_CSV
      : MEDIA_ADVANCED_STANDARD_METRICS_CSV,
    advancedGroupId: isReel ? 'media_advanced_reel' : 'media_advanced_standard',
  }
}

export function getAccountMetricBundles(matrix: SyncCapabilityMatrix): AccountMetricBundle[] {
  const bundles: AccountMetricBundle[] = []

  if (matrix.account.coreEnabled) {
    bundles.push(
      {
        id: 'account_time_series_core',
        metricType: 'time_series',
        metricsCsv: ACCOUNT_TIME_SERIES_CORE_METRICS_CSV,
        core: true,
      },
      {
        id: 'account_total_value_core',
        metricType: 'total_value',
        metricsCsv: ACCOUNT_TOTAL_VALUE_CORE_METRICS_CSV,
        core: true,
      },
    )
  }

  if (matrix.account.advancedEnabled) {
    bundles.push(
      {
        id: 'account_time_series_advanced',
        metricType: 'time_series',
        metricsCsv: ACCOUNT_TIME_SERIES_ADVANCED_METRICS_CSV,
        core: false,
      },
      {
        id: 'account_total_value_advanced',
        metricType: 'total_value',
        metricsCsv: ACCOUNT_TOTAL_VALUE_ADVANCED_METRICS_CSV,
        core: false,
      },
    )
  }

  return bundles
}

export function splitMetricsCsv(metricsCsv: string): string[] {
  return metricsCsv
    .split(',')
    .map((metric) => metric.trim())
    .filter((metric) => metric.length > 0)
}

export interface MetricCoverageResult {
  present: string[]
  missing: string[]
}

export function classifyReturnedMetrics(
  requestedMetricsCsv: string,
  returnedMetricNames: string[],
): MetricCoverageResult {
  const requested = splitMetricsCsv(requestedMetricsCsv)
  const returnedSet = new Set(returnedMetricNames)

  const present: string[] = []
  const missing: string[] = []

  for (const metric of requested) {
    if (returnedSet.has(metric)) present.push(metric)
    else missing.push(metric)
  }

  return { present, missing }
}
