import { useMemo } from 'react'
import { useGoal } from '@/context/GoalContext'
import { computeScores } from '@/lib/scoring'
import type { InstagramMediaWithInsights } from '@/types/database'
import type { ScoringInput, ComputedScore } from '@/types/scoring'

function toScoringInput(m: InstagramMediaWithInsights): ScoringInput | null {
  if (!m.insights) return null
  return {
    mediaId:          m.id,
    reach:            m.insights.reach,
    comments:         m.insights.comments,
    shares:           m.insights.shares,
    saves:            m.insights.saves,
    follows:          m.insights.follows,
    profileVisits:    m.insights.profile_visits,
    avgWatchTimeSec:  m.insights.avg_watch_time_sec,
    durationSeconds:  m.duration_seconds,
    isReel:           m.is_reel,
    caption:          m.caption,
  }
}

/**
 * Computes scores for all media items using the current goal.
 * Re-runs only when `media` or `goal` changes (useMemo).
 * Posts without insights are excluded.
 */
export function useScoringEngine(
  media: InstagramMediaWithInsights[],
): Map<string, ComputedScore> {
  const { goal } = useGoal()

  return useMemo(() => {
    const inputs = media.flatMap(m => {
      const input = toScoringInput(m)
      return input ? [input] : []
    })
    return computeScores(inputs, goal)
  }, [media, goal])
}
