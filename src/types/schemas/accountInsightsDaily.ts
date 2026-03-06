import { z } from 'zod'
import type { InstagramAccountInsightsDaily } from '@/types/database'

const NumberLikeSchema = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), { message: 'Expected numeric value' })

const NullableNumberLikeSchema = z.union([NumberLikeSchema, z.null()])

const AccountInsightsDailyRowSchema = z.object({
  account_id: z.string().uuid(),
  user_id: z.string().uuid(),
  metric_date: z.string(),
  metric_type: z.enum(['time_series', 'total_value']),
  timeframe: z.string(),
  accounts_engaged: NullableNumberLikeSchema,
  reach: NullableNumberLikeSchema,
  views: NullableNumberLikeSchema,
  total_interactions: NullableNumberLikeSchema,
  likes: NullableNumberLikeSchema,
  comments: NullableNumberLikeSchema,
  replies: NullableNumberLikeSchema,
  shares: NullableNumberLikeSchema,
  saves: NullableNumberLikeSchema,
  reposts: NullableNumberLikeSchema,
  profile_links_taps: NullableNumberLikeSchema,
  follows: NullableNumberLikeSchema,
  unfollows: NullableNumberLikeSchema,
  net_follower_growth: NullableNumberLikeSchema,
  updated_at: z.string(),
})

export type AccountInsightsDailyRow = z.infer<typeof AccountInsightsDailyRowSchema>

/**
 * Validates raw account-insights rows from Supabase before they reach charts.
 * This keeps aggregation code simple and prevents malformed payloads from
 * silently rendering misleading totals.
 */
export function parseAccountInsightsRows(rows: unknown): InstagramAccountInsightsDaily[] {
  return z.array(AccountInsightsDailyRowSchema).parse(rows)
}
