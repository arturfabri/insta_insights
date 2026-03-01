import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabaseClient } from '@/lib/supabase'
import type { ComputedScore } from '@/types/scoring'

const DEBOUNCE_MS = 500

function toDbRow(score: ComputedScore, userId: string) {
  return {
    media_id_fk:           score.mediaId,
    user_id:               userId,
    goal:                  score.goal,
    total_score:           score.totalScore,
    distribution_score:    score.distributionScore,
    engagement_depth_score: score.engagementDepthScore,
    conversion_score:      score.conversionScore,
    retention_score:       score.retentionScore,
    value_score:           score.valueScore,
    consideration_score:   score.considerationScore,
    weights_snapshot:      score.weightsSnapshot,
    calculated_at:         new Date().toISOString(),
  }
}

/**
 * Debounced (500 ms) upsert of computed scores to the `scoring_results` table.
 * Call this once after `useScoringEngine` returns.
 * Silently logs errors; never throws.
 */
export function usePersistScores(scores: Map<string, ComputedScore>): void {
  const { user } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user || scores.size === 0) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const rows = [...scores.values()].map(s => toDbRow(s, user.id))
      const { error } = await supabaseClient
        .from('scoring_results')
        .upsert(rows, { onConflict: 'media_id_fk,goal' })
      if (error) {
        console.error('[usePersistScores] upsert failed:', error.message)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scores, user])
}
