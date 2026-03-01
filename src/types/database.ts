// Database table row types — matches supabase/migrations/001_core_tables.sql

export type SyncStatus = 'pending' | 'syncing' | 'complete' | 'error'
export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
export type Goal = 'growth' | 'leads'
export type SyncType = 'initial' | 'manual' | 'cron'
export type SyncLogStatus = 'started' | 'complete' | 'partial' | 'error'

export interface InstagramAccount {
  id: string
  user_id: string
  instagram_user_id: string
  username: string
  access_token_enc: string // Never expose to UI — server-side only
  token_expires_at: string
  last_synced_at: string | null
  sync_status: SyncStatus
  sync_error: string | null
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
  posts_fetched: number | null
  posts_updated: number | null
  error_message: string | null
  started_at: string
  completed_at: string | null
}

// Joined type used in most UI queries
export interface InstagramMediaWithInsights extends InstagramMedia {
  insights: InstagramMediaInsights | null
}
