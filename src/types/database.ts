// Database table row types — matches supabase/migrations/001_core_tables_20260301194643.sql

export type SyncStatus = 'pending' | 'syncing' | 'complete' | 'error' | 'partial'
export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
export type Goal = 'growth' | 'leads'
export type SyncType = 'initial' | 'manual' | 'cron'
export type SyncLogStatus = 'started' | 'complete' | 'partial' | 'error'

export interface InstagramAccount {
  id: string
  user_id: string
  instagram_user_id: string
  username: string
  token_expires_at: string
  last_synced_at: string | null
  sync_status: SyncStatus
  sync_error: string | null
  created_at: string
  updated_at: string
}

export interface InstagramAccountCapabilities {
  account_id: string
  user_id: string
  instagram_connected: boolean
  facebook_connected: boolean
  business_discovery_enabled: boolean
  facebook_token_expires_at: string | null
  status_reason: string
  last_validated_at: string
  created_at: string
  updated_at: string
}

export interface InstagramMedia {
  id: string
  account_id: string
  user_id: string
  media_id: string
  media_type: MediaType
  is_reel: boolean
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  timestamp: string
  duration_seconds: number | null
  media_product_type: string | null
  created_at: string
  updated_at: string
}

export interface InstagramMediaInsights {
  id: string
  media_id_fk: string
  user_id: string
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
  synced_at: string
}

export interface ScoringResult {
  id: string
  media_id_fk: string
  user_id: string
  goal: Goal
  total_score: number
  distribution_score: number | null
  engagement_depth_score: number | null
  conversion_score: number | null
  retention_score: number | null
  value_score: number | null
  consideration_score: number | null
  weights_snapshot: Record<string, number> | null
  calculated_at: string
}

export interface ContentRecommendation {
  id: string
  user_id: string
  account_id: string
  goal: Goal
  request_params: {
    count: number
    formatMix: Record<string, number>
    topPostIds: string[]
  }
  briefs: ContentBrief[]
  generated_at: string
  exported_formats: string[]
}

export interface ContentBrief {
  title: string
  format: MediaType
  hook: string
  structure: string
  captionDraft: string
  cta: string
  rationale: string
}

export interface SyncLog {
  id: string
  account_id: string
  user_id: string
  sync_type: SyncType
  status: SyncLogStatus
  scope: 'media' | 'account' | 'business_discovery' | 'all'
  api_host: string | null
  api_version: string | null
  rate_limit_events: number
  failure_class: string | null
  posts_fetched: number | null
  posts_updated: number | null
  metrics_requested_count: number
  metrics_succeeded_count: number
  metrics_failed_count: number
  metrics_attempted: string[]
  metrics_succeeded: string[]
  metrics_failed: string[]
  capability_gaps: string[]
  provider_error_text: string | null
  provider_error_details: Record<string, string>
  error_message: string | null
  started_at: string
  completed_at: string | null
}

export interface InstagramAccountInsightsDaily {
  account_id: string
  user_id: string
  metric_date: string
  metric_type: string
  timeframe: string
  accounts_engaged: number | null
  reach: number | null
  views: number | null
  total_interactions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reposts: number | null
  profile_links_taps: number | null
  follows: number | null
  unfollows: number | null
  net_follower_growth: number | null
  updated_at: string
}

export interface InstagramBusinessDiscoveryTarget {
  id: string
  account_id: string
  user_id: string
  target_username: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InstagramBusinessDiscoveryProfile {
  target_id: string
  account_id: string
  user_id: string
  ig_user_id: string | null
  username: string | null
  name: string | null
  profile_picture_url: string | null
  followers_count: number | null
  follows_count: number | null
  media_count: number | null
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface InstagramBusinessDiscoveryDaily {
  id: string
  target_id: string
  account_id: string
  user_id: string
  snapshot_date: string
  followers_count: number | null
  follows_count: number | null
  media_count: number | null
  profile_views: number | null
  website_taps: number | null
  captured_at: string
}

// Joined type used in most UI queries
export interface InstagramMediaWithInsights extends InstagramMedia {
  insights: InstagramMediaInsights | null
}
