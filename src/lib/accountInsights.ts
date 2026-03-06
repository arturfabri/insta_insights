import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isAfter,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import type { InstagramAccountInsightsDaily } from '@/types/database'

export type InsightsGranularity = 'day' | 'week' | 'month'

export type AccountInsightAggregationMode =
  | 'sum_per_day_and_bucket'
  | 'latest_in_bucket'
  | 'derived_from_bucket_totals'

export const SUM_BUCKET_METRICS = [
  'reach',
  'views',
  'total_interactions',
  'likes',
  'comments',
  'replies',
  'shares',
  'saves',
  'reposts',
  'profile_links_taps',
  'follows',
  'unfollows',
] as const

export const SNAPSHOT_BUCKET_METRICS = ['accounts_engaged'] as const
export const DERIVED_BUCKET_METRICS = ['net_follower_growth'] as const

export const ALL_ACCOUNT_INSIGHT_METRICS = [
  ...SUM_BUCKET_METRICS,
  ...SNAPSHOT_BUCKET_METRICS,
  ...DERIVED_BUCKET_METRICS,
] as const

export type SumBucketMetricKey = (typeof SUM_BUCKET_METRICS)[number]
export type SnapshotBucketMetricKey = (typeof SNAPSHOT_BUCKET_METRICS)[number]
export type DerivedBucketMetricKey = (typeof DERIVED_BUCKET_METRICS)[number]
export type AccountInsightMetricKey = (typeof ALL_ACCOUNT_INSIGHT_METRICS)[number]

export const ACCOUNT_INSIGHT_AGGREGATION_MODES: Record<
  AccountInsightMetricKey,
  AccountInsightAggregationMode
> = {
  reach: 'sum_per_day_and_bucket',
  views: 'sum_per_day_and_bucket',
  total_interactions: 'sum_per_day_and_bucket',
  likes: 'sum_per_day_and_bucket',
  comments: 'sum_per_day_and_bucket',
  replies: 'sum_per_day_and_bucket',
  shares: 'sum_per_day_and_bucket',
  saves: 'sum_per_day_and_bucket',
  reposts: 'sum_per_day_and_bucket',
  profile_links_taps: 'sum_per_day_and_bucket',
  follows: 'sum_per_day_and_bucket',
  unfollows: 'sum_per_day_and_bucket',
  accounts_engaged: 'latest_in_bucket',
  net_follower_growth: 'derived_from_bucket_totals',
}

export type MetricAvailability = Record<AccountInsightMetricKey, boolean>

export interface AccountInsightsBucket extends Record<AccountInsightMetricKey, number | null> {
  bucketKey: string
  label: string
  bucketStart: string
  bucketEnd: string
}

export interface AccountInsightsSummary {
  currentTotals: Record<AccountInsightMetricKey, number | null>
  previousTotals: Record<AccountInsightMetricKey, number | null>
  latestUpdatedAt: string | null
  metricAvailability: MetricAvailability
  accountsEngagedSparkline: Array<{ label: string; value: number | null }>
}

export interface AccountInsightsViewModel {
  buckets: AccountInsightsBucket[]
  previousBuckets: AccountInsightsBucket[]
  summary: AccountInsightsSummary
}

interface BucketFrame {
  bucketKey: string
  label: string
  bucketStart: string
  bucketEnd: string
}

interface BucketAccumulator {
  bucket: AccountInsightsBucket
  latestSnapshotDateByMetric: Partial<Record<SnapshotBucketMetricKey, string>>
}

function createMetricTotals(): Record<AccountInsightMetricKey, number | null> {
  return {
    reach: 0,
    views: 0,
    total_interactions: 0,
    likes: 0,
    comments: 0,
    replies: 0,
    shares: 0,
    saves: 0,
    reposts: 0,
    profile_links_taps: 0,
    follows: 0,
    unfollows: 0,
    accounts_engaged: null,
    net_follower_growth: 0,
  }
}

function createMetricAvailability(): MetricAvailability {
  return {
    reach: false,
    views: false,
    total_interactions: false,
    likes: false,
    comments: false,
    replies: false,
    shares: false,
    saves: false,
    reposts: false,
    profile_links_taps: false,
    follows: false,
    unfollows: false,
    accounts_engaged: false,
    net_follower_growth: false,
  }
}

function finalizeDerivedMetrics(bucket: AccountInsightsBucket): AccountInsightsBucket {
  const follows = bucket.follows ?? 0
  const unfollows = bucket.unfollows ?? 0
  return {
    ...bucket,
    net_follower_growth: follows - unfollows,
  }
}

function createEmptyBucket(frame: BucketFrame): BucketAccumulator {
  return {
    bucket: finalizeDerivedMetrics({
      ...createMetricTotals(),
      bucketKey: frame.bucketKey,
      label: frame.label,
      bucketStart: frame.bucketStart,
      bucketEnd: frame.bucketEnd,
    }),
    latestSnapshotDateByMetric: {},
  }
}

function latestMetricDate(rows: InstagramAccountInsightsDaily[]): Date {
  return rows.reduce((latest, row) => {
    const candidate = parseISO(row.metric_date)
    return isAfter(candidate, latest) ? candidate : latest
  }, parseISO(rows[0].metric_date))
}

function frameForDate(date: Date, granularity: InsightsGranularity): BucketFrame {
  if (granularity === 'day') {
    const start = startOfDay(date)
    return {
      bucketKey: format(start, 'yyyy-MM-dd'),
      label: format(start, 'd MMM'),
      bucketStart: format(start, 'yyyy-MM-dd'),
      bucketEnd: format(start, 'yyyy-MM-dd'),
    }
  }

  if (granularity === 'week') {
    const start = startOfISOWeek(date)
    const end = addDays(start, 6)
    return {
      bucketKey: format(start, 'yyyy-MM-dd'),
      label: format(start, 'd MMM'),
      bucketStart: format(start, 'yyyy-MM-dd'),
      bucketEnd: format(end, 'yyyy-MM-dd'),
    }
  }

  const start = startOfMonth(date)
  const end = addDays(addMonths(start, 1), -1)
  return {
    bucketKey: format(start, 'yyyy-MM-dd'),
    label: format(start, 'MMM yyyy'),
    bucketStart: format(start, 'yyyy-MM-dd'),
    bucketEnd: format(end, 'yyyy-MM-dd'),
  }
}

function buildFrames(
  anchorDate: Date,
  granularity: InsightsGranularity,
  count: number,
): BucketFrame[] {
  const frames: BucketFrame[] = []
  const startAnchor =
    granularity === 'day'
      ? subDays(startOfDay(anchorDate), count - 1)
      : granularity === 'week'
        ? subWeeks(startOfISOWeek(anchorDate), count - 1)
        : subMonths(startOfMonth(anchorDate), count - 1)

  for (let index = 0; index < count; index += 1) {
    const frameDate =
      granularity === 'day'
        ? addDays(startAnchor, index)
        : granularity === 'week'
          ? addWeeks(startAnchor, index)
          : addMonths(startAnchor, index)
    frames.push(frameForDate(frameDate, granularity))
  }

  return frames
}

function bucketKeyForMetricDate(metricDate: string, granularity: InsightsGranularity): string {
  const date = parseISO(metricDate)
  if (granularity === 'day') return format(startOfDay(date), 'yyyy-MM-dd')
  if (granularity === 'week') return format(startOfISOWeek(date), 'yyyy-MM-dd')
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

function inferGranularity(frames: BucketFrame[]): InsightsGranularity {
  if (frames.length < 2) return 'day'
  const first = parseISO(frames[0].bucketStart)
  const second = parseISO(frames[1].bucketStart)
  const diffDays = Math.round((second.getTime() - first.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays >= 27) return 'month'
  if (diffDays >= 7) return 'week'
  return 'day'
}

function aggregateRowsIntoFrames(
  rows: InstagramAccountInsightsDaily[],
  frames: BucketFrame[],
): AccountInsightsBucket[] {
  const bucketsByKey = new Map<string, BucketAccumulator>(
    frames.map((frame) => [frame.bucketKey, createEmptyBucket(frame)]),
  )
  const granularity = inferGranularity(frames)

  for (const row of rows) {
    const bucketKey = bucketKeyForMetricDate(row.metric_date, granularity)
    const accumulator = bucketsByKey.get(bucketKey)
    if (!accumulator) continue

    for (const metric of SUM_BUCKET_METRICS) {
      const nextValue = row[metric]
      if (nextValue == null) continue
      accumulator.bucket[metric] = (accumulator.bucket[metric] ?? 0) + nextValue
    }

    for (const metric of SNAPSHOT_BUCKET_METRICS) {
      const nextValue = row[metric]
      if (nextValue == null) continue
      const lastDate = accumulator.latestSnapshotDateByMetric[metric]
      if (!lastDate || row.metric_date >= lastDate) {
        accumulator.bucket[metric] = nextValue
        accumulator.latestSnapshotDateByMetric[metric] = row.metric_date
      }
    }

    accumulator.bucket = finalizeDerivedMetrics(accumulator.bucket)
  }

  return frames.map((frame) => bucketsByKey.get(frame.bucketKey)!.bucket)
}

function summarizeBuckets(
  buckets: AccountInsightsBucket[],
): Record<AccountInsightMetricKey, number | null> {
  const totals = createMetricTotals()

  for (const metric of SUM_BUCKET_METRICS) {
    totals[metric] = buckets.reduce((sum, bucket) => sum + (bucket[metric] ?? 0), 0)
  }

  const latestAccountsEngaged = [...buckets]
    .reverse()
    .find((bucket) => bucket.accounts_engaged != null)
  totals.accounts_engaged = latestAccountsEngaged?.accounts_engaged ?? null
  totals.net_follower_growth = (totals.follows ?? 0) - (totals.unfollows ?? 0)

  return totals
}

function collectMetricAvailability(rows: InstagramAccountInsightsDaily[]): MetricAvailability {
  const availability = createMetricAvailability()

  for (const row of rows) {
    for (const metric of ALL_ACCOUNT_INSIGHT_METRICS) {
      if (metric === 'net_follower_growth') {
        if (row.follows != null || row.unfollows != null || row.net_follower_growth != null) {
          availability.net_follower_growth = true
        }
        continue
      }

      if (row[metric] != null) {
        availability[metric] = true
      }
    }
  }

  return availability
}

function latestUpdatedAt(rows: InstagramAccountInsightsDaily[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    if (!latest) return row.updated_at
    return row.updated_at > latest ? row.updated_at : latest
  }, null)
}

function frameCountFor(granularity: InsightsGranularity): number {
  if (granularity === 'day') return 30
  if (granularity === 'week') return 12
  return 12
}

/**
 * Aggregates daily account insight rows into chart buckets using local product
 * semantics instead of Meta's provider metric_type. Provider metric_type is
 * preserved in storage, but bucket rollups are defined per metric here.
 */
export function buildAccountInsightsView(
  rows: InstagramAccountInsightsDaily[],
  granularity: InsightsGranularity,
): AccountInsightsViewModel {
  if (rows.length === 0) {
    return {
      buckets: [],
      previousBuckets: [],
      summary: {
        currentTotals: createMetricTotals(),
        previousTotals: createMetricTotals(),
        latestUpdatedAt: null,
        metricAvailability: createMetricAvailability(),
        accountsEngagedSparkline: [],
      },
    }
  }

  const anchorDate = latestMetricDate(rows)
  const bucketCount = frameCountFor(granularity)
  const currentFrames = buildFrames(anchorDate, granularity, bucketCount)
  const previousAnchorDate = subDays(parseISO(currentFrames[0].bucketStart), 1)
  const previousFrames = buildFrames(previousAnchorDate, granularity, bucketCount)

  const currentBuckets = aggregateRowsIntoFrames(rows, currentFrames)
  const previousBuckets = aggregateRowsIntoFrames(rows, previousFrames)
  const availability = collectMetricAvailability(rows)

  return {
    buckets: currentBuckets,
    previousBuckets,
    summary: {
      currentTotals: summarizeBuckets(currentBuckets),
      previousTotals: summarizeBuckets(previousBuckets),
      latestUpdatedAt: latestUpdatedAt(rows),
      metricAvailability: availability,
      accountsEngagedSparkline: currentBuckets.map((bucket) => ({
        label: bucket.label,
        value: bucket.accounts_engaged,
      })),
    },
  }
}
