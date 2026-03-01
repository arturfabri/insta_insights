import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabaseClient } from '@/lib/supabase'

type Status = 'processing' | 'success' | 'error'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Read URL params once — used by both state initializers and the effect
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Derive initial status/error from URL params at render time so the effect
  // body never needs to call setState synchronously (avoids lint warnings).
  const [status, setStatus] = useState<Status>(() =>
    errorParam || !code ? 'error' : 'processing'
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (errorParam) return errorDescription ?? 'Instagram authorisation was denied.'
    if (!code) return 'No authorisation code received. Please try connecting again.'
    return null
  })

  const called = useRef(false)

  useEffect(() => {
    // Nothing to do if we're already in an error state (no code or OAuth error)
    if (!code) return

    // Guard against StrictMode double-invocation
    if (called.current) return
    called.current = true

    async function exchangeCode() {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          setStatus('error')
          setErrorMessage('Your session expired. Please sign in and try again.')
          return
        }

        const { error } = await supabaseClient.functions.invoke('instagram-oauth', {
          body: {
            code,
            redirectUri: `${window.location.origin}/oauth/callback`,
          },
        })

        if (error) {
          setStatus('error')
          setErrorMessage(error.message ?? 'Failed to connect Instagram account.')
          return
        }

        setStatus('success')
        setTimeout(() => navigate('/'), 1500)
      } catch (err) {
        setStatus('error')
        setErrorMessage('An unexpected error occurred. Please try again.')
        console.error('OAuth callback error:', err)
      }
    }

    void exchangeCode()
  }, [code, navigate])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Connection failed</h1>
          <p className="text-sm text-gray-500 mb-6">{errorMessage}</p>
          <Link
            to="/connect"
            className="inline-block bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Try again
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Instagram connected!</h1>
          <p className="text-sm text-gray-500">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Connecting your Instagram account…</p>
      </div>
    </div>
  )
}
