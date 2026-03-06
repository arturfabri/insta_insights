import { describe, expect, it } from 'vitest'
import {
  buildSyncCapabilityMatrix,
  classifyReturnedMetrics,
  getAccountMetricBundles,
  getMediaMetricBundles,
  resolveSyncWindow,
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
      apiHost: 'https://graph.instagram.com/v22.0',
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
    apiHost: 'https://graph.instagram.com/v22.0',
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

  it('returns core and advanced account bundle groups', () => {
    const bundles = getAccountMetricBundles(matrix)
    expect(bundles.map((bundle) => bundle.id)).toEqual([
      'account_time_series_core',
      'account_total_value_core',
      'account_time_series_advanced',
      'account_total_value_advanced',
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

  it('matches the observed CSV regression pattern where only six media metrics are returned', () => {
    const coverage = classifyReturnedMetrics(
      'reach,views,saved,shares,comments,total_interactions,replies,reposts,profile_activity',
      ['reach', 'views', 'saved', 'shares', 'comments'],
    )

    expect(coverage.present).toEqual(['reach', 'views', 'saved', 'shares', 'comments'])
    expect(coverage.missing).toEqual(['total_interactions', 'replies', 'reposts', 'profile_activity'])
  })
})
