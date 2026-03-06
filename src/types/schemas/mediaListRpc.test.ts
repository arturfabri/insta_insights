import { describe, expect, it } from 'vitest'
import { parseMediaListRpcRows } from './mediaListRpc'

function makeRow() {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    media_id: 'ig-1',
    media_type: 'VIDEO',
    is_reel: true,
    caption: 'caption',
    permalink: null,
    thumbnail_url: null,
    media_url: null,
    timestamp: '2025-01-01T00:00:00Z',
    duration_seconds: 30,
    media_product_type: 'REELS',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    insights_id: '00000000-0000-4000-8000-000000000020',
    insights_media_id_fk: '00000000-0000-4000-8000-000000000001',
    insights_user_id: '00000000-0000-4000-8000-000000000011',
    insights_reach: 100,
    insights_impressions: 0,
    insights_plays: 75,
    insights_video_views: null,
    insights_views: 75,
    insights_total_interactions: 20,
    insights_profile_activity: 1,
    insights_replies: 2,
    insights_reposts: 3,
    insights_reels_skip_rate: 0.2,
    insights_crossposted_views: 60,
    insights_facebook_views: 15,
    insights_completion_rate: 0.4,
    insights_avg_watch_time_sec: 12,
    insights_total_watch_time_ms: 32000,
    insights_likes: 10,
    insights_comments: 5,
    insights_shares: 3,
    insights_saves: 2,
    insights_profile_visits: 0,
    insights_follows: 0,
    insights_engagement_rate: 0.2,
    insights_synced_at: '2025-01-01T00:01:00Z',
  }
}

describe('parseMediaListRpcRows', () => {
  it('parses a valid RPC payload and maps nested insights', () => {
    const result = parseMediaListRpcRows([makeRow()])
    expect(result).toHaveLength(1)
    expect(result[0].is_reel).toBe(true)
    expect(result[0].insights?.plays).toBe(75)
    expect(result[0].insights?.facebook_views).toBe(15)
    expect(result[0].insights?.completion_rate).toBe(0.4)
    expect(result[0].insights?.total_watch_time_ms).toBe(32000)
  })

  it('throws for malformed payload', () => {
    expect(() => parseMediaListRpcRows([{ id: 'bad' }])).toThrow()
  })
})
