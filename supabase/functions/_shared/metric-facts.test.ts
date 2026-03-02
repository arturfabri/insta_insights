import { describe, expect, it } from 'vitest'
import {
  mapAccountMetricsToFacts,
  mapSnapshotMetricsToFacts,
  normalizeFetchDate,
  type IGInsightMetric,
} from './metric-facts'

function metric(
  name: string,
  values: Array<{ value: number | Record<string, unknown>; end_time?: string }>,
): IGInsightMetric {
  return {
    name,
    period: 'day',
    values,
  }
}

const BASE_INPUT = {
  userId: '00000000-0000-4000-8000-000000000011',
  accountId: '00000000-0000-4000-8000-000000000022',
  entityId: '00000000-0000-4000-8000-000000000033',
  fetchDate: '2026-03-02',
  fetchedAtIso: '2026-03-02T10:00:00.000Z',
}

describe('normalizeFetchDate', () => {
  it('returns UTC date for valid ISO timestamp', () => {
    expect(normalizeFetchDate('2026-03-02T10:00:00.000Z')).toBe('2026-03-02')
  })

  it('throws for invalid timestamp', () => {
    expect(() => normalizeFetchDate('invalid')).toThrow(/Invalid fetch timestamp/i)
  })
})

describe('mapSnapshotMetricsToFacts', () => {
  it('uses fetch date for snapshot-style metrics', () => {
    const rows = mapSnapshotMetricsToFacts({
      ...BASE_INPUT,
      scope: 'media',
      metrics: [metric('reach', [{ value: 123 }])],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].metric_date).toBe('2026-03-02')
    expect(rows[0].metric_value_numeric).toBe(123)
  })
})

describe('mapAccountMetricsToFacts', () => {
  it('uses API-provided day for time_series values', () => {
    const rows = mapAccountMetricsToFacts({
      ...BASE_INPUT,
      scope: 'account',
      metricSeriesType: 'time_series',
      metricType: 'time_series',
      metrics: [
        metric('reach', [
          { value: 99, end_time: '2026-03-01T00:00:00+0000' },
          { value: 88, end_time: '2026-03-02T00:00:00+0000' },
        ]),
      ],
    })

    expect(rows).toHaveLength(2)
    expect(rows[0].metric_date).toBe('2026-03-01')
    expect(rows[1].metric_date).toBe('2026-03-02')
  })

  it('falls back to fetch date when time_series value lacks end_time', () => {
    const rows = mapAccountMetricsToFacts({
      ...BASE_INPUT,
      scope: 'account',
      metricSeriesType: 'time_series',
      metricType: 'time_series',
      metrics: [metric('views', [{ value: 11 }])],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].metric_date).toBe('2026-03-02')
  })

  it('uses fetch date for total_value rows', () => {
    const rows = mapAccountMetricsToFacts({
      ...BASE_INPUT,
      scope: 'account',
      metricSeriesType: 'total_value',
      metricType: 'total_value',
      metrics: [metric('accounts_engaged', [{ value: 333, end_time: '2026-02-28T00:00:00+0000' }])],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].metric_date).toBe('2026-03-02')
  })

  it('stores object-valued metrics in jsonb field', () => {
    const rows = mapAccountMetricsToFacts({
      ...BASE_INPUT,
      scope: 'account',
      metricSeriesType: 'total_value',
      metricType: 'total_value',
      metrics: [
        metric('follows_and_unfollows', [
          { value: { follows: 10, unfollows: 2 } },
        ]),
      ],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].metric_value_numeric).toBeNull()
    expect(rows[0].metric_value_jsonb).toEqual({ follows: 10, unfollows: 2 })
  })
})
