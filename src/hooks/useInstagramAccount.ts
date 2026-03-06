import { useEffect, useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { InstagramAccount } from '@/types/database'

interface UseInstagramAccountResult {
  account: InstagramAccount | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useInstagramAccount(): UseInstagramAccountResult {
  const { user } = useAuth()
  const [account, setAccount] = useState<InstagramAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Trigger token — incrementing causes the effect to re-run (for refetch)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId) {
        setAccount(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabaseClient
        .from('instagram_accounts')
        .select(
          'id, user_id, instagram_user_id, username, token_expires_at, last_synced_at, sync_status, sync_error, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setAccount(null)
      } else {
        setAccount(data as InstagramAccount | null)
      }
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [trigger, userId])

  return { account, loading, error, refetch }
}
