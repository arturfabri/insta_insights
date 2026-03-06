import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInstagramAccount } from './useInstagramAccount'

const mockFrom = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function buildQueryChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    instagram_user_id: 'ig-1',
    username: 'creator',
    token_expires_at: '2030-01-01T00:00:00Z',
    last_synced_at: null,
    sync_status: 'complete',
    sync_error: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('useInstagramAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
  })

  it('returns the single connected account for the user', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: [makeAccount()], error: null }))

    const { result } = renderHook(() => useInstagramAccount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.account?.id).toBe('acc-1')
    expect(result.current.error).toBeNull()
  })

  it('returns null when no account exists for the user', async () => {
    mockFrom.mockReturnValue(buildQueryChain({ data: [], error: null }))

    const { result } = renderHook(() => useInstagramAccount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.account).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('fails closed when duplicate account rows exist', async () => {
    mockFrom.mockReturnValue(
      buildQueryChain({
        data: [makeAccount(), makeAccount({ id: 'acc-2', instagram_user_id: 'ig-2' })],
        error: null,
      }),
    )

    const { result } = renderHook(() => useInstagramAccount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.account).toBeNull()
    expect(result.current.error).toMatch(/multiple instagram accounts/i)
  })

  it('does not query when no auth user is present', async () => {
    mockUseAuth.mockReturnValue({ user: null })

    const { result } = renderHook(() => useInstagramAccount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.account).toBeNull()
  })
})
