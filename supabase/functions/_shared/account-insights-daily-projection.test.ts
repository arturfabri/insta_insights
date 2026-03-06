import { describe, expect, it } from 'vitest'
import {
  projectAccountFactsToDailyRows,
} from './account-insights-daily-projection'
import type { MetricFactRow } from './metric-facts'

function makeFact(
  metricName: string,
  overrides: Partial<MetricFactRow> = {},
): MetricFactRow {
  return {
    user_id: '00000000-0000-4000-8000-000000000011',
    account_id: '00000000-0000-4000-8000-000000000022',
    scope: 'account',
    entity_id: '00000000-0000-4000-8000-000000000022',
    metric_name: metricName,
    metric_value_numeric: null,
    metric_value_jsonb: null,
    period: 'day',
    metric_type: 'total_value',
    timeframe: '',
    breakdown_type: '',
    breakdown_value: '',
    metric_date: '2026-03-02',
    fetched_at: '2026-03-02T10:00:00.000Z',
    ...overrides,
  }
}

describe('projectAccountFactsToDailyRows', () => {
  it('writes reach from the time_series bundle into the daily projection', () => {
    const rows = projectAccountFactsToDailyRows(
      [
        makeFact('reach', {
          metric_type: 'time_series',
          metric_value_numeric: 123,
          metric_date: '2026-03-01',
        }),
      ],
      '00000000-0000-4000-8000-000000000022',
      '00000000-0000-4000-8000-000000000011',
      'time_series',
    )

    expect(rows).toEqual([
      expect.objectContaining({
        metric_date: '2026-03-01',
        metric_type: 'time_series',
        reach: 123,
      }),
    ])
  })

  it('maps activity metrics and derives follower growth from follows_and_unfollows', () => {
    const rows = projectAccountFactsToDailyRows(
      [
        makeFact('accounts_engaged', { metric_value_numeric: 800 }),
        makeFact('views', { metric_value_numeric: 210 }),
        makeFact('comments', { metric_value_numeric: 12 }),
        makeFact('replies', { metric_value_numeric: 3 }),
        makeFact('follows_and_unfollows', {
          metric_value_jsonb: { follows: 17, unfollows: 5 },
        }),
      ],
      '00000000-0000-4000-8000-000000000022',
      '00000000-0000-4000-8000-000000000011',
      'total_value',
    )

    expect(rows).toEqual([
      expect.objectContaining({
        metric_type: 'total_value',
        accounts_engaged: 800,
        views: 210,
        comments: 12,
        replies: 3,
        follows: 17,
        unfollows: 5,
        net_follower_growth: 12,
      }),
    ])
  })

  it('keeps demographics out of the daily projection', () => {
    const rows = projectAccountFactsToDailyRows(
      [
        makeFact('engaged_audience_demographics', {
          metric_value_jsonb: { age: { '25-34': 100 } },
        }),
      ],
      '00000000-0000-4000-8000-000000000022',
      '00000000-0000-4000-8000-000000000011',
      'total_value',
    )

    expect(rows).toEqual([])
  })
})
