import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OAuthCallbackPage from './OAuthCallbackPage'

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
    <MemoryRouter initialEntries={[`/oauth/callback${search}`]}>
      <OAuthCallbackPage />
    </MemoryRouter>
  )
}

describe('OAuthCallbackPage', () => {
  it('shows session-expired error when code is present but no auth session exists', async () => {
    renderCallback('?code=test123')
    await screen.findByText(/connection failed/i)
    expect(screen.getByText(/session expired/i)).toBeInTheDocument()
  })

  it('shows error state when error param is present', async () => {
    renderCallback('?error=access_denied&error_description=User+denied+access')
    const alert = await screen.findByText(/connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/user denied access/i)).toBeInTheDocument()
  })

  it('shows error state when no code param is present', async () => {
    renderCallback('')
    const alert = await screen.findByText(/connection failed/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/no authorisation code/i)).toBeInTheDocument()
  })

  it('shows try again link on error', async () => {
    renderCallback('?error=access_denied')
    await screen.findByText(/connection failed/i)
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/connect')
  })
})
