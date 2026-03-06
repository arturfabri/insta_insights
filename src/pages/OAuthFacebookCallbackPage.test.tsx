import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OAuthFacebookCallbackPage from './OAuthFacebookCallbackPage'
import { buildBusinessLoginState } from '@/lib/account-capabilities'

vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

function renderCallback(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/oauth/facebook-callback${search}`]}>
      <OAuthFacebookCallbackPage />
    </MemoryRouter>,
  )
}

describe('OAuthFacebookCallbackPage', () => {
  it('shows session-expired error when code is present but no auth session exists', async () => {
    const state = buildBusinessLoginState('acc-1')
    renderCallback(`?code=test123&state=${encodeURIComponent(state)}`)
    await screen.findByText(/meta connection failed/i)
    expect(screen.getByText(/session expired/i)).toBeInTheDocument()
  })

  it('shows error state when oauth error param is present', async () => {
    renderCallback('?error=access_denied&error_description=User+denied+access')
    const alert = await screen.findByText(/meta connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/user denied access/i)).toBeInTheDocument()
  })

  it('shows error state when code param is missing', async () => {
    const state = buildBusinessLoginState('acc-1')
    renderCallback(`?state=${encodeURIComponent(state)}`)
    const alert = await screen.findByText(/meta connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/no authorisation code/i)).toBeInTheDocument()
  })

  it('allows first-time connect state without an accountId', async () => {
    const state = buildBusinessLoginState(null)
    renderCallback(`?code=test123&state=${encodeURIComponent(state)}`)
    await screen.findByText(/meta connection failed/i)
    expect(screen.getByText(/session expired/i)).toBeInTheDocument()
  })

  it('shows error state when oauth state is missing', async () => {
    renderCallback('?code=test123')
    const alert = await screen.findByText(/meta connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/missing oauth state/i)).toBeInTheDocument()
  })

  it('shows back-to-connections link on error', async () => {
    renderCallback('?error=access_denied')
    await screen.findByText(/meta connection failed/i)
    expect(screen.getByRole('link', { name: /back to connections/i })).toHaveAttribute('href', '/connect')
  })
})
