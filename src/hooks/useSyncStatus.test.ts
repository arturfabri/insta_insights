import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSyncStatus } from './useSyncStatus'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

const mockFrom = vi.fn()
const mockRemoveChannel = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: vi.fn(() => mockChannel),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
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
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset channel mock to avoid stale chaining
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockReturnThis()
  })

  it('returns null syncStatus when no account exists', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: null, error: null }))

    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.syncStatus).toBeNull()
    })
  })

  it('returns sync status from the database', async () => {
    mockFrom.mockReturnValue(
      buildQueryChain({
        data: { sync_status: 'complete', last_synced_at: '2025-01-01T10:00:00Z', sync_error: null },
        error: null,
      }),
    )

    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('complete')
      expect(result.current.lastSyncedAt).toBe('2025-01-01T10:00:00Z')
      expect(result.current.syncError).toBeNull()
    })
  })

  it('returns error info when sync_status is error', async () => {
    mockFrom.mockReturnValue(
      buildQueryChain({
        data: {
          sync_status: 'error',
          last_synced_at: null,
          sync_error: 'Rate limit exceeded',
        },
        error: null,
      }),
    )

    const { result } = renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error')
      expect(result.current.syncError).toBe('Rate limit exceeded')
    })
  })

  it('subscribes to Realtime on mount', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: null, error: null }))

    renderHook(() => useSyncStatus())

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalled()
    })
    expect(mockChannel.subscribe).toHaveBeenCalled()
  })

  it('removes the Realtime channel on unmount', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: null, error: null }))

    const { unmount } = renderHook(() => useSyncStatus())
    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalled()
    })

    unmount()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
