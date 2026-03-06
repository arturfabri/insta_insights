import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { format, subDays } from 'date-fns'
import { useAccountInsights } from './useAccountInsights'

const mockFrom = vi.fn()
const mockUseInstagramAccount = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/hooks/useInstagramAccount', () => ({
  useInstagramAccount: () => mockUseInstagramAccount(),
}))

function buildQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  return chain
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    metric_date: '2026-03-01',
    metric_type: 'time_series',
    timeframe: '',
    accounts_engaged: null,
    reach: 120,
    views: 80,
    total_interactions: 30,
    likes: 10,
    comments: 5,
    replies: 2,
    shares: 3,
    saves: 2,
    reposts: 1,
    profile_links_taps: 4,
    follows: null,
    unfollows: null,
    net_follower_growth: null,
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  }
}

describe('useAccountInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseInstagramAccount.mockReturnValue({
      account: {
        id: '00000000-0000-4000-8000-000000000010',
        user_id: '00000000-0000-4000-8000-000000000011',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00Z',
        last_synced_at: null,
        sync_status: 'complete',
        sync_error: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('queries the active account with timeframe filtering and validation', async () => {
    const chain = buildQueryChain({ data: [makeRow()], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAccountInsights())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('instagram_account_insights_daily')
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'account_id', '00000000-0000-4000-8000-000000000010')
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'timeframe', '')
    expect(chain.gte).toHaveBeenCalledWith('metric_date', format(subDays(new Date(), 400), 'yyyy-MM-dd'))
    expect(result.current.insights).toHaveLength(1)
  })

  it('returns empty data when there is no active account', async () => {
    mockUseInstagramAccount.mockReturnValue({
      account: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useAccountInsights())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.insights).toEqual([])
  })

  it('surfaces database errors', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: null, error: { message: 'DB error' } }))

    const { result } = renderHook(() => useAccountInsights())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('DB error')
    expect(result.current.insights).toEqual([])
  })

  it('surfaces validation errors for malformed payloads', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: [{ bad: 'payload' }], error: null }))

    const { result } = renderHook(() => useAccountInsights())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toMatch(/Invalid account insights payload from server/i)
  })
})
