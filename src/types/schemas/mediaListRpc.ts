import { z } from 'zod'
import type { InstagramMediaWithInsights, MediaType } from '@/types/database'

const MediaTypeSchema = z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'])
const NumberLikeSchema = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected numeric value' })
const NullableNumberLikeSchema = z.union([NumberLikeSchema, z.null()])

const MediaListRpcRowSchema = z.object({
  id: z.string().uuid(),
  account_id: z.string().uuid(),
  user_id: z.string().uuid(),
  media_id: z.string(),
  media_type: MediaTypeSchema,
  is_reel: z.boolean(),
  caption: z.string().nullable(),
  permalink: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  media_url: z.string().nullable(),
  timestamp: z.string(),
  duration_seconds: NullableNumberLikeSchema,
  created_at: z.string(),
  updated_at: z.string(),
  insights_id: z.string().uuid().nullable(),
  insights_media_id_fk: z.string().uuid().nullable(),
  insights_user_id: z.string().uuid().nullable(),
  insights_reach: NullableNumberLikeSchema,
  insights_impressions: NullableNumberLikeSchema,
  insights_plays: NullableNumberLikeSchema,
  insights_video_views: NullableNumberLikeSchema,
  insights_avg_watch_time_sec: NullableNumberLikeSchema,
  insights_total_watch_time_ms: NullableNumberLikeSchema,
  insights_likes: NullableNumberLikeSchema,
  insights_comments: NullableNumberLikeSchema,
  insights_shares: NullableNumberLikeSchema,
  insights_saves: NullableNumberLikeSchema,
  insights_profile_visits: NullableNumberLikeSchema,
  insights_follows: NullableNumberLikeSchema,
  insights_engagement_rate: NullableNumberLikeSchema,
  insights_synced_at: z.string().nullable(),
})

export type MediaListRpcRow = z.infer<typeof MediaListRpcRowSchema>

export function parseMediaListRpcRows(rows: unknown): InstagramMediaWithInsights[] {
  const parsedRows = z.array(MediaListRpcRowSchema).parse(rows)

  return parsedRows.map((row) => {
    const media: InstagramMediaWithInsights = {
      id: row.id,
      account_id: row.account_id,
      user_id: row.user_id,
      media_id: row.media_id,
      media_type: row.media_type as MediaType,
      is_reel: row.is_reel,
      caption: row.caption,
      permalink: row.permalink,
      thumbnail_url: row.thumbnail_url,
      media_url: row.media_url,
      timestamp: row.timestamp,
      duration_seconds: row.duration_seconds,
      created_at: row.created_at,
      updated_at: row.updated_at,
      insights: null,
    }

    if (row.insights_id) {
      media.insights = {
        id: row.insights_id,
        media_id_fk: row.insights_media_id_fk ?? row.id,
        user_id: row.insights_user_id ?? row.user_id,
        reach: row.insights_reach ?? 0,
        impressions: row.insights_impressions ?? 0,
        plays: row.insights_plays,
        video_views: row.insights_video_views,
        avg_watch_time_sec: row.insights_avg_watch_time_sec,
        total_watch_time_ms: row.insights_total_watch_time_ms,
        likes: row.insights_likes ?? 0,
        comments: row.insights_comments ?? 0,
        shares: row.insights_shares ?? 0,
        saves: row.insights_saves ?? 0,
        profile_visits: row.insights_profile_visits ?? 0,
        follows: row.insights_follows ?? 0,
        engagement_rate: row.insights_engagement_rate,
        synced_at: row.insights_synced_at ?? row.updated_at,
      }
    }

    return media
  })
}
