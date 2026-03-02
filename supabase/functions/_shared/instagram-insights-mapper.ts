export interface IGInsightMetric {
  name: string
  values: Array<{ value: number; end_time?: string }>
}

export interface MapInsightsInput {
  insightsData: IGInsightMetric[]
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  isReel: boolean
  likeCount: number
  durationSeconds?: number | null
}

export interface InstagramInsightsDbRow {
  reach: number
  impressions: number
  plays: number | null
  video_views: number | null
  views: number | null
  total_interactions: number | null
  profile_activity: number | null
  replies: number | null
  reposts: number | null
  reels_skip_rate: number | null
  crossposted_views: number | null
  facebook_views: number | null
  completion_rate: number | null
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
  const { insightsData, mediaType, isReel, likeCount, durationSeconds = null } = input

  const reach = extractMetric(insightsData, 'reach') ?? 0
  const views = extractMetric(insightsData, 'views') ?? 0
  const totalInteractions = extractMetric(insightsData, 'total_interactions')
  const profileActivity = extractMetric(insightsData, 'profile_activity')
  const replies = extractMetric(insightsData, 'replies')
  const reposts = extractMetric(insightsData, 'reposts')
  const reelsSkipRate = extractMetric(insightsData, 'reels_skip_rate')
  const crosspostedViews = extractMetric(insightsData, 'crossposted_views')
  const facebookViews = extractMetric(insightsData, 'facebook_views')
  const saves = extractMetric(insightsData, 'saved') ?? 0
  const shares = extractMetric(insightsData, 'shares') ?? 0
  const comments = extractMetric(insightsData, 'comments') ?? 0

  let impressions = 0
  let plays: number | null = null
  let videoViews: number | null = null
  let totalWatchTimeMs: number | null = null
  let avgWatchTimeSec: number | null = null
  let completionRate: number | null = null

  if (isReel) {
    plays = views
    totalWatchTimeMs = extractMetric(insightsData, 'ig_reels_video_view_total_time')
    const avgWatchTimeMs = extractMetric(insightsData, 'ig_reels_avg_watch_time')
    avgWatchTimeSec = avgWatchTimeMs !== null ? avgWatchTimeMs / 1000 : null
    if (avgWatchTimeSec !== null && durationSeconds !== null && durationSeconds > 0) {
      completionRate = Math.min(avgWatchTimeSec / durationSeconds, 1)
    }
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
    views,
    total_interactions: totalInteractions,
    profile_activity: profileActivity,
    replies,
    reposts,
    reels_skip_rate: reelsSkipRate,
    crossposted_views: crosspostedViews,
    facebook_views: facebookViews,
    completion_rate: completionRate,
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
