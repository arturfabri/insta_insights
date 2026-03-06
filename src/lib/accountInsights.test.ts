import { describe, expect, it } from 'vitest'
import {
  buildAccountInsightsView,
  type InsightsGranularity,
} from './accountInsights'
import type { InstagramAccountInsightsDaily } from '@/types/database'

function makeRow(
  metricDate: string,
  metricType: 'time_series' | 'total_value',
  overrides: Partial<InstagramAccountInsightsDaily> = {},
): InstagramAccountInsightsDaily {
  return {
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    metric_date: metricDate,
    metric_type: metricType,
    timeframe: '',
    accounts_engaged: null,
    reach: null,
    views: null,
    total_interactions: null,
    likes: null,
    comments: null,
    replies: null,
    shares: null,
    saves: null,
    reposts: null,
    profile_links_taps: null,
    follows: null,
    unfollows: null,
    net_follower_growth: null,
    updated_at: `${metricDate}T10:00:00Z`,
    ...overrides,
  }
}

function buildRows(): InstagramAccountInsightsDaily[] {
  return [
    makeRow('2026-02-24', 'time_series', { reach: 40 }),
    makeRow('2026-02-25', 'time_series', { reach: 50 }),
    makeRow('2026-02-25', 'total_value', { views: 20, likes: 2 }),
    makeRow('2026-02-28', 'time_series', { reach: 60 }),
    makeRow('2026-02-28', 'total_value', { views: 30, total_interactions: 15, profile_links_taps: 3 }),
    makeRow('2026-03-01', 'total_value', {
      accounts_engaged: 100,
      views: 40,
      total_interactions: 20,
      likes: 5,
      comments: 2,
      follows: 12,
      unfollows: 4,
      net_follower_growth: 8,
    }),
    makeRow('2026-03-02', 'total_value', {
      accounts_engaged: 110,
      views: 50,
      total_interactions: 25,
      shares: 4,
      follows: 14,
      unfollows: 5,
      net_follower_growth: 9,
    }),
    makeRow('2026-03-03', 'total_value', {
      accounts_engaged: 115,
      views: 60,
      total_interactions: 30,
      replies: 3,
      saves: 6,
      follows: 15,
      unfollows: 6,
      net_follower_growth: 9,
    }),
    makeRow('2026-03-15', 'time_series', { reach: 100 }),
    makeRow('2026-03-15', 'total_value', {
      accounts_engaged: 130,
      views: 70,
      total_interactions: 35,
      reposts: 1,
      follows: 20,
      unfollows: 7,
      net_follower_growth: 13,
    }),
  ]
}

function viewFor(granularity: InsightsGranularity) {
  return buildAccountInsightsView(buildRows(), granularity)
}

describe('buildAccountInsightsView', () => {
  it('builds 30 daily buckets and places values on the matching day', () => {
    const view = viewFor('day')

    expect(view.buckets).toHaveLength(30)
    const marchThird = view.buckets.find((bucket) => bucket.bucketStart === '2026-03-03')
    expect(marchThird?.reach).toBe(0)
    expect(marchThird?.views).toBe(60)
    expect(marchThird?.accounts_engaged).toBe(115)
  })

  it('sums bucketed daily metrics regardless of provider metric_type', () => {
    const view = viewFor('week')
    const weekOfFeb23 = view.buckets.find((bucket) => bucket.bucketStart === '2026-02-23')

    expect(weekOfFeb23?.reach).toBe(150)
    expect(weekOfFeb23?.views).toBe(90)
    expect(weekOfFeb23?.total_interactions).toBe(35)
  })

  it('sums chartable metrics into monthly buckets and derives net growth from bucket totals', () => {
    const view = viewFor('month')
    const marchBucket = view.buckets.find((bucket) => bucket.bucketStart === '2026-03-01')

    expect(marchBucket?.reach).toBe(100)
    expect(marchBucket?.views).toBe(220)
    expect(marchBucket?.total_interactions).toBe(110)
    expect(marchBucket?.replies).toBe(3)
    expect(marchBucket?.net_follower_growth).toBe(39)
  })

  it('keeps only accounts engaged as the latest snapshot-style metric in each bucket', () => {
    const view = viewFor('week')
    const weekOfFeb23 = view.buckets.find((bucket) => bucket.bucketStart === '2026-02-23')
    const weekOfMar09 = view.buckets.find((bucket) => bucket.bucketStart === '2026-03-09')

    expect(weekOfFeb23?.accounts_engaged).toBe(100)
    expect(weekOfFeb23?.net_follower_growth).toBe(8)
    expect(weekOfMar09?.accounts_engaged).toBe(130)
    expect(weekOfMar09?.net_follower_growth).toBe(13)
  })

  it('calculates previous-period totals for KPI deltas', () => {
    const view = viewFor('week')

    expect(view.summary.currentTotals.reach).toBeGreaterThan(0)
    expect(view.summary.previousTotals.reach).toBe(0)
    expect(view.summary.currentTotals.accounts_engaged).toBe(130)
    expect(view.summary.currentTotals.net_follower_growth).toBe(39)
  })
})
