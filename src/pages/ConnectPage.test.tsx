import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConnectPage from './ConnectPage'

const mockUseInstagramAccount = vi.fn()
const mockUseSyncStatus = vi.fn()
const mockUseAccountCapabilities = vi.fn()

vi.mock('@/hooks/useInstagramAccount', () => ({
  useInstagramAccount: (...args: unknown[]) => mockUseInstagramAccount(...args),
}))

vi.mock('@/hooks/useSyncStatus', () => ({
  useSyncStatus: (...args: unknown[]) => mockUseSyncStatus(...args),
}))

vi.mock('@/hooks/useAccountCapabilities', () => ({
  useAccountCapabilities: (...args: unknown[]) => mockUseAccountCapabilities(...args),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

function renderConnect() {
  return render(
    <MemoryRouter>
      <ConnectPage />
    </MemoryRouter>,
  )
}

describe('ConnectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUseInstagramAccount.mockReturnValue({
      account: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseSyncStatus.mockReturnValue({
      syncStatus: null,
      lastSyncedAt: null,
      syncError: null,
    })
    mockUseAccountCapabilities.mockReturnValue({
      capabilities: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('shows a single Meta Business Login CTA when no account is connected', () => {
    renderConnect()

    expect(screen.getByRole('heading', { name: /connect instagram via meta/i })).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /continue with meta business login/i })
    expect(cta).toHaveAttribute('href', expect.stringContaining('/v25.0/dialog/oauth'))
    expect(cta).toHaveAttribute('href', expect.stringContaining('enable_fb_login=true'))
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining(
        'scope=instagram_business_basic%2Cinstagram_business_manage_insights%2Cpages_show_list%2Cpages_read_engagement',
      ),
    )
  })

  it('requires reconnect and hides sync controls for legacy accounts without a business-login capability row', () => {
    mockUseInstagramAccount.mockReturnValue({
      account: {
        id: 'acc-1',
        user_id: 'user-1',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00.000Z',
        last_synced_at: null,
        sync_status: 'pending',
        sync_error: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderConnect()

    expect(screen.getByText(/this account was connected before the business login flow was enforced/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /reconnect account/i })).toHaveAttribute(
      'href',
      expect.stringContaining('enable_fb_login=true'),
    )
    expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument()
  })

  it('shows sync controls after a valid business-login capability is present', () => {
    mockUseInstagramAccount.mockReturnValue({
      account: {
        id: 'acc-1',
        user_id: 'user-1',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00.000Z',
        last_synced_at: '2026-03-02T00:00:00.000Z',
        sync_status: 'complete',
        sync_error: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-02T00:00:00.000Z',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseSyncStatus.mockReturnValue({
      syncStatus: 'complete',
      lastSyncedAt: '2026-03-02T00:00:00.000Z',
      syncError: null,
    })
    mockUseAccountCapabilities.mockReturnValue({
      capabilities: {
        account_id: 'acc-1',
        user_id: 'user-1',
        instagram_connected: true,
        facebook_connected: true,
        business_discovery_enabled: true,
        facebook_token_expires_at: '2030-01-01T00:00:00.000Z',
        status_reason: 'meta_upgraded',
        last_validated_at: '2026-03-02T00:00:00.000Z',
        created_at: '2026-03-02T00:00:00.000Z',
        updated_at: '2026-03-02T00:00:00.000Z',
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderConnect()

    expect(screen.getByText(/business login active/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
