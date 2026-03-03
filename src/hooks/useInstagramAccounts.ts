import { useEffect, useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { InstagramAccount } from '@/types/database'

interface UseInstagramAccountsResult {
  accounts: InstagramAccount[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useInstagramAccounts(): UseInstagramAccountsResult {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<InstagramAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId) {
        setAccounts([])
        setLoading(false)
        setError(null)
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

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setAccounts([])
      } else {
        setAccounts((data ?? []) as InstagramAccount[])
      }
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [trigger, userId])

  return { accounts, loading, error, refetch }
}
