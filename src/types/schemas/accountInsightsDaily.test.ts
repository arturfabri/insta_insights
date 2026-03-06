import { describe, expect, it } from 'vitest'
import { parseAccountInsightsRows } from './accountInsightsDaily'

function makeRow() {
  return {
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    metric_date: '2026-03-01',
    metric_type: 'time_series',
    timeframe: '',
    accounts_engaged: null,
    reach: 120,
    views: '60',
    total_interactions: 30,
    likes: 10,
    comments: 5,
    replies: 2,
    shares: 4,
    saves: 3,
    reposts: 2,
    profile_links_taps: 1,
    follows: null,
    unfollows: null,
    net_follower_growth: null,
    updated_at: '2026-03-01T10:00:00Z',
  }
}

describe('parseAccountInsightsRows', () => {
  it('parses valid account insights rows', () => {
    const parsed = parseAccountInsightsRows([makeRow()])

    expect(parsed).toHaveLength(1)
    expect(parsed[0].views).toBe(60)
    expect(parsed[0].metric_type).toBe('time_series')
  })

  it('throws for malformed payloads', () => {
    expect(() => parseAccountInsightsRows([{ metric_date: '2026-03-01' }])).toThrow()
  })
})
