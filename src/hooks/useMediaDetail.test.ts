import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMediaDetail } from './useMediaDetail'

const mockRpc = vi.fn()
let mockUser: { id: string } | null = { id: 'user-1' }

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

function makeRpcRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    media_id: 'ig-1',
    media_type: 'IMAGE',
    is_reel: false,
    caption: 'Test caption',
    permalink: null,
    thumbnail_url: null,
    media_url: null,
    timestamp: '2025-01-01T00:00:00Z',
    duration_seconds: null,
    media_product_type: 'FEED',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    insights_id: '00000000-0000-4000-8000-000000000020',
    insights_media_id_fk: '00000000-0000-4000-8000-000000000001',
    insights_user_id: '00000000-0000-4000-8000-000000000011',
    insights_reach: 120,
    insights_impressions: 80,
    insights_plays: null,
    insights_video_views: null,
    insights_views: 80,
    insights_total_interactions: 21,
    insights_profile_activity: 0,
    insights_replies: 0,
    insights_reposts: 0,
    insights_reels_skip_rate: null,
    insights_crossposted_views: null,
    insights_facebook_views: null,
    insights_completion_rate: null,
    insights_avg_watch_time_sec: null,
    insights_total_watch_time_ms: null,
    insights_likes: 10,
    insights_comments: 5,
    insights_shares: 2,
    insights_saves: 4,
    insights_profile_visits: 0,
    insights_follows: 0,
    insights_engagement_rate: 0.21,
    insights_synced_at: '2025-01-01T00:01:00Z',
    ...overrides,
  }
}

describe('useMediaDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { id: 'user-1' }
  })

  it('fetches detail from media RPC with row id filter', async () => {
    mockRpc.mockResolvedValue({ data: [makeRpcRow()], error: null })

    const { result } = renderHook(() => useMediaDetail('00000000-0000-4000-8000-000000000001'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockRpc).toHaveBeenCalledWith('list_media_with_insights', {
      p_sort_by: 'timestamp',
      p_media_type: null,
      p_is_reel: null,
      p_limit: 1,
      p_media_row_id: '00000000-0000-4000-8000-000000000001',
    })
    expect(result.current.media?.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(result.current.media?.insights?.reach).toBe(120)
  })

  it('returns null media when RPC returns no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useMediaDetail('00000000-0000-4000-8000-000000000001'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.media).toBeNull()
  })

  it('returns error when RPC query fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const { result } = renderHook(() => useMediaDetail('00000000-0000-4000-8000-000000000001'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('DB error')
    expect(result.current.media).toBeNull()
  })

  it('returns validation error for malformed RPC payload', async () => {
    mockRpc.mockResolvedValue({ data: [{ bad: 'payload' }], error: null })

    const { result } = renderHook(() => useMediaDetail('00000000-0000-4000-8000-000000000001'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toMatch(/Invalid media payload from server/i)
    expect(result.current.media).toBeNull()
  })

  it('skips query when user is not authenticated', async () => {
    mockUser = null

    const { result } = renderHook(() => useMediaDetail('00000000-0000-4000-8000-000000000001'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockRpc).not.toHaveBeenCalled()
    expect(result.current.media).toBeNull()
  })
})
