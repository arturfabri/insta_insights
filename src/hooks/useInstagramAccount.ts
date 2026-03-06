import { useCallback, useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { InstagramAccount } from '@/types/database'

interface UseInstagramAccountResult {
  account: InstagramAccount | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Loads the single Instagram account linked to the current user.
 * If multiple rows ever appear, the hook fails closed instead of silently
 * choosing one because the product only supports one account per user.
 */
export function useInstagramAccount(): UseInstagramAccountResult {
  const { user } = useAuth()
  const [account, setAccount] = useState<InstagramAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((value) => value + 1), [])

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId) {
        setAccount(null)
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
        .limit(2)

      if (cancelled) return

      if (dbError) {
        setAccount(null)
        setError(dbError.message)
        setLoading(false)
        return
      }

      if ((data?.length ?? 0) > 1) {
        setAccount(null)
        setError('Multiple Instagram accounts are linked to this user. Resolve the duplicate account rows before continuing.')
        setLoading(false)
        return
      }

      setAccount(((data ?? [])[0] as InstagramAccount | undefined) ?? null)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [trigger, userId])

  return { account, loading, error, refetch }
}
