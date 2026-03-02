import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { GoalProvider } from '@/context/GoalContext'
import { useScoringEngine } from './useScoringEngine'
import type { InstagramMediaWithInsights } from '@/types/database'

// Prevent the supabase singleton from throwing during import
vi.mock('@/lib/supabase', () => ({
  supabaseClient: {},
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return createElement(GoalProvider, null, children)
}

function makeMedia(
  id: string,
  overrides?: Partial<InstagramMediaWithInsights>,
): InstagramMediaWithInsights {
  return {
    id,
    account_id:       'acc-1',
    user_id:          'user-1',
    media_id:         `ig-${id}`,
    media_type:       'IMAGE',
    is_reel:          false,
    caption:          null,
    permalink:        null,
    thumbnail_url:    null,
    media_url:        null,
    timestamp:        '2024-01-01T00:00:00Z',
    duration_seconds: null,
    media_product_type: 'FEED',
    created_at:       '2024-01-01T00:00:00Z',
    updated_at:       '2024-01-01T00:00:00Z',
    insights: {
      id:                 `ins-${id}`,
      media_id_fk:        id,
      user_id:            'user-1',
      reach:              1000,
      impressions:        1500,
      plays:              null,
      video_views:        null,
      views:              null,
      total_interactions: null,
      profile_activity:   null,
      replies:            null,
      reposts:            null,
      reels_skip_rate:    null,
      crossposted_views:  null,
      facebook_views:     null,
      completion_rate:    null,
      avg_watch_time_sec: null,
      total_watch_time_ms: null,
      likes:              100,
      comments:           50,
      shares:             30,
      saves:              80,
      profile_visits:     100,
      follows:            20,
      engagement_rate:    0.28,
      synced_at:          '2024-01-01T00:00:00Z',
    },
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useScoringEngine', () => {
  it('returns an empty Map for an empty media array', () => {
    const { result } = renderHook(() => useScoringEngine([]), { wrapper })
    expect(result.current.size).toBe(0)
  })

  it('returns a Map entry for each media item that has insights', () => {
    const media = [makeMedia('a'), makeMedia('b')]
    const { result } = renderHook(() => useScoringEngine(media), { wrapper })
    expect(result.current.size).toBe(2)
    expect(result.current.has('a')).toBe(true)
    expect(result.current.has('b')).toBe(true)
  })

  it('excludes media without insights', () => {
    const withInsights = makeMedia('x')
    const withoutInsights = makeMedia('y', { insights: null })
    const { result } = renderHook(
      () => useScoringEngine([withInsights, withoutInsights]),
      { wrapper },
    )
    expect(result.current.size).toBe(1)
    expect(result.current.has('x')).toBe(true)
    expect(result.current.has('y')).toBe(false)
  })

  it('each score has a totalScore in [0, 100]', () => {
    const media = [makeMedia('p1'), makeMedia('p2'), makeMedia('p3')]
    const { result } = renderHook(() => useScoringEngine(media), { wrapper })
    for (const score of result.current.values()) {
      expect(score.totalScore).toBeGreaterThanOrEqual(0)
      expect(score.totalScore).toBeLessThanOrEqual(100)
    }
  })

  it('uses "growth" goal by default (from GoalContext)', () => {
    const { result } = renderHook(() => useScoringEngine([makeMedia('g1')]), { wrapper })
    const score = result.current.get('g1')
    expect(score?.goal).toBe('growth')
  })

  it('returns the same Map reference when media array reference is stable', () => {
    const media = [makeMedia('stable')]
    const { result, rerender } = renderHook(() => useScoringEngine(media), { wrapper })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
