import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DAY_TIME_SERIES_CORE_METRICS_CSV,
  ACCOUNT_DAY_TOTAL_VALUE_ACTIVITY_METRICS_CSV,
  ACCOUNT_LIFETIME_TOTAL_VALUE_DEMOGRAPHIC_METRICS_CSV,
  buildSyncCapabilityMatrix,
  classifyReturnedMetrics,
  getAccountMetricBundles,
  getMediaMetricBundles,
  resolveSyncWindow,
  splitMetricsCsv,
} from './sync-metric-capabilities'

describe('resolveSyncWindow', () => {
  it('uses sync period in standard mode', () => {
    const resolved = resolveSyncWindow({ syncMode: 'standard', syncPeriodDays: 180 })
    expect(resolved).toEqual({ mode: 'standard', periodDays: 180, source: 'sync_period' })
  })

  it('uses backfill days in backfill mode', () => {
    const resolved = resolveSyncWindow({ syncMode: 'backfill', syncPeriodDays: 90, backfillDays: 360 })
    expect(resolved).toEqual({ mode: 'backfill', periodDays: 360, source: 'backfill' })
  })

  it('falls back to default when provided days are invalid', () => {
    const resolved = resolveSyncWindow({ syncMode: 'backfill', backfillDays: 45 })
    expect(resolved).toEqual({ mode: 'backfill', periodDays: 90, source: 'default' })
  })
})

describe('buildSyncCapabilityMatrix', () => {
  it('enables media/account bundles for instagram host and business discovery when allowed', () => {
    const matrix = buildSyncCapabilityMatrix({
      apiHost: 'https://graph.instagram.com/v25.0',
      businessDiscoveryRequested: true,
      canRunBusinessDiscovery: true,
    })

    expect(matrix.apiHost).toBe('graph.instagram.com')
    expect(matrix.media.coreEnabled).toBe(true)
    expect(matrix.media.advancedEnabled).toBe(true)
    expect(matrix.account.coreEnabled).toBe(true)
    expect(matrix.account.advancedEnabled).toBe(true)
    expect(matrix.businessDiscovery.enabled).toBe(true)
  })

  it('disables media/account bundles for unknown host', () => {
    const matrix = buildSyncCapabilityMatrix({
      apiHost: 'https://example.com',
      businessDiscoveryRequested: true,
      canRunBusinessDiscovery: true,
    })

    expect(matrix.apiHost).toBe('unknown')
    expect(matrix.media.coreEnabled).toBe(false)
    expect(matrix.account.coreEnabled).toBe(false)
  })
})

describe('metric bundle planners', () => {
  const matrix = buildSyncCapabilityMatrix({
    apiHost: 'https://graph.instagram.com/v25.0',
    businessDiscoveryRequested: false,
    canRunBusinessDiscovery: false,
  })

  it('returns reel-specific advanced media bundle', () => {
    const bundles = getMediaMetricBundles(true, matrix)
    expect(bundles.coreMetricsCsv).toContain('reach')
    expect(bundles.advancedMetricsCsv).toContain('reels_skip_rate')
    expect(bundles.advancedGroupId).toBe('media_advanced_reel')
  })

  it('returns standard advanced media bundle', () => {
    const bundles = getMediaMetricBundles(false, matrix)
    expect(bundles.advancedMetricsCsv).toContain('profile_activity')
    expect(bundles.advancedGroupId).toBe('media_advanced_standard')
  })

  it('returns the exact account bundle catalog that matches Meta metric types', () => {
    const bundles = getAccountMetricBundles(matrix)
    expect(bundles).toEqual([
      {
        id: 'account_day_time_series_core',
        metricType: 'time_series',
        period: 'day',
        metricsCsv: ACCOUNT_DAY_TIME_SERIES_CORE_METRICS_CSV,
        projectionTarget: 'daily',
        core: true,
      },
      {
        id: 'account_day_total_value_activity',
        metricType: 'total_value',
        period: 'day',
        metricsCsv: ACCOUNT_DAY_TOTAL_VALUE_ACTIVITY_METRICS_CSV,
        projectionTarget: 'daily',
        core: true,
      },
      {
        id: 'account_lifetime_total_value_demographics',
        metricType: 'total_value',
        period: 'lifetime',
        metricsCsv: ACCOUNT_LIFETIME_TOTAL_VALUE_DEMOGRAPHIC_METRICS_CSV,
        projectionTarget: 'facts_only',
        timeframes: ['last_14_days', 'last_30_days', 'last_90_days', 'prev_month', 'this_month', 'this_week'],
        breakdowns: ['age', 'city', 'country', 'gender'],
        core: false,
      },
    ])
  })

  it('does not duplicate account metrics across bundle definitions', () => {
    const metricsByBundle = getAccountMetricBundles(matrix).map((bundle) => splitMetricsCsv(bundle.metricsCsv))
    const flatMetrics = metricsByBundle.flat()
    const duplicatedMetrics = flatMetrics.filter((metric, index) => flatMetrics.indexOf(metric) !== index)

    expect(duplicatedMetrics).toEqual([])
    expect(splitMetricsCsv(ACCOUNT_DAY_TIME_SERIES_CORE_METRICS_CSV)).toEqual(['reach'])
    expect(splitMetricsCsv(ACCOUNT_DAY_TOTAL_VALUE_ACTIVITY_METRICS_CSV)).toContain('replies')
    expect(splitMetricsCsv(ACCOUNT_LIFETIME_TOTAL_VALUE_DEMOGRAPHIC_METRICS_CSV)).toEqual([
      'engaged_audience_demographics',
      'follower_demographics',
    ])
  })
})

describe('classifyReturnedMetrics', () => {
  it('detects missing metrics from partially populated response', () => {
    const coverage = classifyReturnedMetrics(
      'reach,views,total_interactions,reposts',
      ['reach', 'views'],
    )

    expect(coverage.present).toEqual(['reach', 'views'])
    expect(coverage.missing).toEqual(['total_interactions', 'reposts'])
  })

  it('matches the observed CSV regression pattern where only a subset of metrics are returned', () => {
    const coverage = classifyReturnedMetrics(
      'accounts_engaged,comments,follows_and_unfollows,likes,profile_links_taps,replies,reposts,saves,shares,total_interactions,views',
      ['accounts_engaged', 'follows_and_unfollows', 'views'],
    )

    expect(coverage.present).toEqual(['accounts_engaged', 'follows_and_unfollows', 'views'])
    expect(coverage.missing).toEqual([
      'comments',
      'likes',
      'profile_links_taps',
      'replies',
      'reposts',
      'saves',
      'shares',
      'total_interactions',
    ])
  })
})
