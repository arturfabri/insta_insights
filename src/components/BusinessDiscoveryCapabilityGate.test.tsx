import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BusinessDiscoveryCapabilityGate from './BusinessDiscoveryCapabilityGate'

const mockUseAccountCapabilities = vi.fn()

vi.mock('@/hooks/useAccountCapabilities', () => ({
  useAccountCapabilities: (...args: unknown[]) => mockUseAccountCapabilities(...args),
}))

describe('BusinessDiscoveryCapabilityGate', () => {
  it('shows loading state while capability lookup is running', () => {
    mockUseAccountCapabilities.mockReturnValue({
      capabilities: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <BusinessDiscoveryCapabilityGate accountId="acc-1">
          <div>Allowed content</div>
        </BusinessDiscoveryCapabilityGate>
      </MemoryRouter>,
    )

    expect(screen.getByText(/checking meta capability state/i)).toBeInTheDocument()
  })

  it('renders children when business discovery capability is enabled', () => {
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

    render(
      <MemoryRouter>
        <BusinessDiscoveryCapabilityGate accountId="acc-1">
          <div>Allowed content</div>
        </BusinessDiscoveryCapabilityGate>
      </MemoryRouter>,
    )

    expect(screen.getByText('Allowed content')).toBeInTheDocument()
  })

  it('renders blocking prompt when capability is missing', () => {
    mockUseAccountCapabilities.mockReturnValue({
      capabilities: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter>
        <BusinessDiscoveryCapabilityGate accountId="acc-42">
          <div>Allowed content</div>
        </BusinessDiscoveryCapabilityGate>
      </MemoryRouter>,
    )

    expect(screen.getByText(/meta connection required/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /connect meta/i })).toHaveAttribute(
      'href',
      '/connect?accountId=acc-42',
    )
  })
})
