import { describe, expect, it } from 'vitest'
import { mapInstagramInsightsToDb, type IGInsightMetric } from './instagram-insights-mapper'

function metric(name: string, value: number): IGInsightMetric {
  return {
    name,
    period: 'lifetime',
    title: name,
    description: name,
    id: name,
    values: [{ value }],
  } as IGInsightMetric
}

describe('mapInstagramInsightsToDb', () => {
  it('maps reel metrics with watch-time fields correctly', () => {
    const result = mapInstagramInsightsToDb({
      insightsData: [
        metric('reach', 100),
        metric('views', 80),
        metric('saved', 10),
        metric('shares', 5),
        metric('comments', 4),
        metric('ig_reels_video_view_total_time', 60000),
        metric('ig_reels_avg_watch_time', 15000),
      ],
      mediaType: 'VIDEO',
      isReel: true,
      likeCount: 20,
      durationSeconds: 30,
    })

    expect(result.plays).toBe(80)
    expect(result.video_views).toBeNull()
    expect(result.total_watch_time_ms).toBe(60000)
    expect(result.avg_watch_time_sec).toBe(15)
    expect(result.completion_rate).toBe(0.5)
  })

  it('maps non-reel video views to video_views', () => {
    const result = mapInstagramInsightsToDb({
      insightsData: [metric('reach', 50), metric('views', 30)],
      mediaType: 'VIDEO',
      isReel: false,
      likeCount: 5,
    })

    expect(result.video_views).toBe(30)
    expect(result.impressions).toBe(0)
    expect(result.plays).toBeNull()
  })

  it('maps image/carousel views to impressions', () => {
    const result = mapInstagramInsightsToDb({
      insightsData: [metric('reach', 40), metric('views', 28)],
      mediaType: 'IMAGE',
      isReel: false,
      likeCount: 4,
    })

    expect(result.impressions).toBe(28)
    expect(result.video_views).toBeNull()
    expect(result.plays).toBeNull()
  })
})
