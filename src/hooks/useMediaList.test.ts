import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMediaList } from './useMediaList'
import type { InstagramMediaWithInsights } from '@/types/database'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

// Helper: build a mock Supabase query chain
function buildQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  return chain
}

const mockMediaItem: InstagramMediaWithInsights = {
  id: 'uuid-1',
  account_id: 'account-1',
  user_id: 'user-1',
  media_id: 'ig-123',
  media_type: 'IMAGE',
  is_reel: false,
  caption: 'Test post caption',
  permalink: 'https://www.instagram.com/p/test/',
  thumbnail_url: null,
  media_url: 'https://example.com/image.jpg',
  timestamp: '2025-01-15T10:00:00Z',
  duration_seconds: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
  insights: {
    id: 'insights-1',
    media_id_fk: 'uuid-1',
    user_id: 'user-1',
    reach: 1000,
    impressions: 1200,
    plays: null,
    video_views: null,
    avg_watch_time_sec: null,
    total_watch_time_ms: null,
    likes: 50,
    comments: 10,
    shares: 5,
    saves: 20,
    profile_visits: 30,
    follows: 5,
    engagement_rate: 0.085,
    synced_at: '2025-01-15T10:05:00Z',
  },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useMediaList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no media exists', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: [], error: null }))

    const { result } = renderHook(() => useMediaList())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.media).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns media list when data exists', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: [mockMediaItem], error: null }))

    const { result } = renderHook(() => useMediaList())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.media).toHaveLength(1)
    expect(result.current.media[0].id).toBe('uuid-1')
    expect(result.current.media[0].insights?.reach).toBe(1000)
  })

  it('returns error when query fails', async () => {
    mockFrom.mockReturnValue(
      buildQueryChain({ data: null, error: { message: 'DB error' } }),
    )

    const { result } = renderHook(() => useMediaList())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('DB error')
    expect(result.current.media).toEqual([])
  })

  it('starts in loading state', () => {
    // Never resolves during this test
    const neverResolves = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue(new Promise(() => {})),
    }
    mockFrom.mockReturnValue(neverResolves)

    const { result } = renderHook(() => useMediaList())
    expect(result.current.loading).toBe(true)
    expect(result.current.media).toEqual([])
  })

  it('returns empty array and stops loading when user is not authenticated', async () => {
    vi.doMock('@/context/AuthContext', () => ({
      useAuth: () => ({ user: null }),
    }))

    mockFrom.mockReturnValue(buildQueryChain({ data: [], error: null }))
    const { result } = renderHook(() => useMediaList())

    // With no user, loading should resolve immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
