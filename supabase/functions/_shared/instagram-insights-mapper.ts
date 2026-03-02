export interface IGInsightMetric {
  name: string
  values: Array<{ value: number; end_time?: string }>
}

export interface MapInsightsInput {
  insightsData: IGInsightMetric[]
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  isReel: boolean
  likeCount: number
}

export interface InstagramInsightsDbRow {
  reach: number
  impressions: number
  plays: number | null
  video_views: number | null
  avg_watch_time_sec: number | null
  total_watch_time_ms: number | null
  likes: number
  comments: number
  shares: number
  saves: number
  profile_visits: number
  follows: number
  engagement_rate: number | null
}

function extractMetric(data: IGInsightMetric[], name: string): number | null {
  const metric = data.find((m) => m.name === name)
  if (!metric) return null
  return metric.values?.[0]?.value ?? null
}

export function mapInstagramInsightsToDb(input: MapInsightsInput): InstagramInsightsDbRow {
  const { insightsData, mediaType, isReel, likeCount } = input

  const reach = extractMetric(insightsData, 'reach') ?? 0
  const views = extractMetric(insightsData, 'views') ?? 0
  const saves = extractMetric(insightsData, 'saved') ?? 0
  const shares = extractMetric(insightsData, 'shares') ?? 0
  const comments = extractMetric(insightsData, 'comments') ?? 0

  let impressions = 0
  let plays: number | null = null
  let videoViews: number | null = null
  let totalWatchTimeMs: number | null = null
  let avgWatchTimeSec: number | null = null

  if (isReel) {
    plays = views
    totalWatchTimeMs = extractMetric(insightsData, 'ig_reels_video_view_total_time')
    const avgWatchTimeMs = extractMetric(insightsData, 'ig_reels_avg_watch_time')
    avgWatchTimeSec = avgWatchTimeMs !== null ? avgWatchTimeMs / 1000 : null
  } else if (mediaType === 'VIDEO') {
    videoViews = views
  } else {
    impressions = views
  }

  const engagementRate =
    reach > 0 ? (likeCount + comments + shares + saves) / reach : null

  return {
    reach,
    impressions,
    plays,
    video_views: videoViews,
    avg_watch_time_sec: avgWatchTimeSec,
    total_watch_time_ms: totalWatchTimeMs,
    likes: likeCount,
    comments,
    shares,
    saves,
    profile_visits: 0,
    follows: 0,
    engagement_rate: engagementRate,
  }
}
