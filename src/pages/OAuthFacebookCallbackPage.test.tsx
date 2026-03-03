import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OAuthFacebookCallbackPage from './OAuthFacebookCallbackPage'

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
    const state = window.btoa(JSON.stringify({ accountId: 'acc-1' }))
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
    const state = window.btoa(JSON.stringify({ accountId: 'acc-1' }))
    renderCallback(`?state=${encodeURIComponent(state)}`)
    const alert = await screen.findByText(/meta connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/no authorisation code/i)).toBeInTheDocument()
  })

  it('shows error state when oauth state does not include account context', async () => {
    renderCallback('?code=test123')
    const alert = await screen.findByText(/meta connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/missing account context/i)).toBeInTheDocument()
  })

  it('shows back-to-connections link on error', async () => {
    renderCallback('?error=access_denied')
    await screen.findByText(/meta connection failed/i)
    expect(screen.getByRole('link', { name: /back to connections/i })).toHaveAttribute('href', '/connect')
  })
})
