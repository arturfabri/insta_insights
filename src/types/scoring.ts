import type { Goal } from './database'

export type { Goal }

/** p95 ratios computed across all posts with reach > 0 */
export interface Baselines {
  sharesReach_p95: number
  savesReach_p95: number
  commentsReach_p95: number
  followsReach_p95: number
  profileVisitsReach_p95: number
}

/** Flat input needed by both scoring models */
export interface ScoringInput {
  mediaId: string
  reach: number
  comments: number
  shares: number
  saves: number
  follows: number
  profileVisits: number
  avgWatchTimeSec: number | null
  durationSeconds: number | null
  isReel: boolean
  caption: string | null
}

/** Score result — sub-scores are 0–100; null means "not applicable for this goal" */
export interface ComputedScore {
  mediaId: string
  goal: Goal
  totalScore: number             // 0–100, rounded
  distributionScore: number | null
  engagementDepthScore: number | null
  conversionScore: number | null
  retentionScore: number | null
  valueScore: number | null
  considerationScore: number | null
  weightsSnapshot: Record<string, number>
}
