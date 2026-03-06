import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useInstagramAccounts } from './useInstagramAccounts'

const mockUseInstagramAccount = vi.fn()

vi.mock('@/hooks/useInstagramAccount', () => ({
  useInstagramAccount: () => mockUseInstagramAccount(),
}))

describe('useInstagramAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps the single account in an array for compatibility consumers', () => {
    mockUseInstagramAccount.mockReturnValue({
      account: {
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
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useInstagramAccounts())

    expect(result.current.accounts).toHaveLength(1)
    expect(result.current.accounts[0]?.id).toBe('acc-1')
  })

  it('never returns more than one account', () => {
    mockUseInstagramAccount.mockReturnValue({
      account: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useInstagramAccounts())

    expect(result.current.accounts).toEqual([])
  })
})
