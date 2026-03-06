import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabaseClient } from '@/lib/supabase'
import {
  parseBusinessLoginCallbackParams,
  parseBusinessLoginState,
} from '@/lib/account-capabilities'

type Status = 'processing' | 'success' | 'error'

export default function OAuthFacebookCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const callbackParams = parseBusinessLoginCallbackParams(searchParams)
  const { code, state, error, errorDescription, validationError } = callbackParams
  const { accountId, error: stateError } = parseBusinessLoginState(state)

  const [status, setStatus] = useState<Status>(() =>
    error || !code || stateError || validationError ? 'error' : 'processing',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (validationError) return validationError
    if (error) return errorDescription ?? 'Meta authorisation was denied.'
    if (!code) return 'No authorisation code received. Please try connecting again.'
    if (stateError) return stateError
    return null
  })

  const called = useRef(false)

  useEffect(() => {
    if (!code || error || stateError || validationError) return
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

        const { data, error } = await supabaseClient.functions.invoke<{
          success: boolean
          error?: string
        }>('instagram-oauth-facebook', {
          body: {
            code,
            accountId,
            redirectUri: `${window.location.origin}/oauth/facebook-callback`,
          },
        })

        if (error) {
          setStatus('error')
          setErrorMessage(error.message ?? 'Failed to connect Meta account.')
          return
        }

        if (!data?.success) {
          setStatus('error')
          setErrorMessage(data?.error ?? 'Failed to connect Meta account.')
          return
        }

        setStatus('success')
        setTimeout(() => navigate('/connect'), 1500)
      } catch (err) {
        setStatus('error')
        setErrorMessage('An unexpected error occurred. Please try again.')
        console.error('Facebook OAuth callback error:', err)
      }
    }

    void exchangeCode()
  }, [accountId, code, error, navigate, stateError, validationError])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Meta connection failed</h1>
          <p className="text-sm text-gray-500 mb-6">{errorMessage}</p>
          <Link
            to="/connect"
            className="inline-block bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Back to connections
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
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Business connection complete</h1>
          <p className="text-sm text-gray-500">Redirecting to connections…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Connecting your Instagram business account…</p>
      </div>
    </div>
  )
}
