import { useCallback, useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import type { InstagramAccountCapabilities } from '@/types/database'

interface UseAccountCapabilitiesResult {
  capabilities: InstagramAccountCapabilities | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAccountCapabilities(accountId: string | null | undefined): UseAccountCapabilitiesResult {
  const [capabilities, setCapabilities] = useState<InstagramAccountCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!accountId) {
        setCapabilities(null)
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabaseClient
        .from('instagram_account_capabilities')
        .select(
          'account_id, user_id, instagram_connected, facebook_connected, business_discovery_enabled, facebook_token_expires_at, status_reason, last_validated_at, created_at, updated_at',
        )
        .eq('account_id', accountId)
        .maybeSingle()

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setCapabilities(null)
      } else {
        setCapabilities((data ?? null) as InstagramAccountCapabilities | null)
      }
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [accountId, trigger])

  return { capabilities, loading, error, refetch }
}
