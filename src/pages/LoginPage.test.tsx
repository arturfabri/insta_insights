import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseClient: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { supabaseClient } from '@/lib/supabase'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderLogin() {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
  }

  it('renders sign in form', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation error when fields are empty', async () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/please enter your email and password/i)
    })
    expect(supabaseClient.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('calls signInWithPassword with correct args', async () => {
    vi.mocked(supabaseClient.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    } as never)

    renderLogin()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(supabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('shows error message on auth failure', async () => {
    vi.mocked(supabaseClient.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials', name: 'AuthError', status: 400 },
    } as never)

    renderLogin()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i)
    })
  })

  it('navigates to / on success', async () => {
    vi.mocked(supabaseClient.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: { id: '1' } as never, session: {} as never },
      error: null,
    })

    renderLogin()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
