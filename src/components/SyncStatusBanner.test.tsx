import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SyncStatusBanner from './SyncStatusBanner'
import type { SyncStatus } from '@/types/database'

// ── Mock useSyncStatus ────────────────────────────────────────────────────────

let mockSyncStatus: SyncStatus | null = null
let mockLastSyncedAt: string | null = null
let mockSyncError: string | null = null

vi.mock('@/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    syncStatus: mockSyncStatus,
    lastSyncedAt: mockLastSyncedAt,
    syncError: mockSyncError,
  }),
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SyncStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSyncStatus = null
    mockLastSyncedAt = null
    mockSyncError = null
  })

  it('renders nothing when syncStatus is null', () => {
    const { container } = render(<SyncStatusBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when syncStatus is pending', () => {
    mockSyncStatus = 'pending'
    const { container } = render(<SyncStatusBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows spinner and text when syncing', () => {
    mockSyncStatus = 'syncing'
    render(<SyncStatusBanner />)
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    expect(screen.getByText(/syncing your posts/i)).toBeInTheDocument()
  })

  it('shows success message when complete', () => {
    mockSyncStatus = 'complete'
    mockLastSyncedAt = new Date().toISOString()
    render(<SyncStatusBanner />)
    expect(screen.getByText(/synced/i)).toBeInTheDocument()
  })

  it('shows partial warning with retry button', () => {
    mockSyncStatus = 'partial'
    const onRetry = vi.fn()
    render(<SyncStatusBanner onRetry={onRetry} />)

    expect(screen.getByText(/partial sync/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()

    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows error message with retry button', () => {
    mockSyncStatus = 'error'
    mockSyncError = 'API rate limit exceeded'
    const onRetry = vi.fn()
    render(<SyncStatusBanner onRetry={onRetry} />)

    expect(screen.getByText(/API rate limit exceeded/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()

    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows fallback error text when syncError is null on error status', () => {
    mockSyncStatus = 'error'
    mockSyncError = null
    render(<SyncStatusBanner />)
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
  })

  it('does not render retry button when onRetry is not provided', () => {
    mockSyncStatus = 'error'
    mockSyncError = 'Something went wrong'
    render(<SyncStatusBanner />)
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })
})
