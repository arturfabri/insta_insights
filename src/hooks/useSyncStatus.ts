import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { SyncStatus } from '@/types/database'

interface UseSyncStatusResult {
  syncStatus: SyncStatus | null
  lastSyncedAt: string | null
  syncError: string | null
}

export function useSyncStatus(): UseSyncStatusResult {
  const { user } = useAuth()
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const userId = user?.id

  // Initial fetch
  useEffect(() => {
    if (!userId) return

    let cancelled = false

    async function fetchStatus() {
      const { data, error } = await supabaseClient
        .from('instagram_accounts')
        .select('sync_status, last_synced_at, sync_error')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (error || !data) return

      setSyncStatus(data.sync_status as SyncStatus)
      setLastSyncedAt(data.last_synced_at)
      setSyncError(data.sync_error)
    }

    void fetchStatus()
    return () => { cancelled = true }
  }, [userId])

  // Realtime subscription — updates live as sync_status changes on the server
  useEffect(() => {
    if (!userId) return

    const channel = supabaseClient
      .channel(`sync-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'instagram_accounts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            sync_status: SyncStatus
            last_synced_at: string | null
            sync_error: string | null
          }
          setSyncStatus(row.sync_status)
          setLastSyncedAt(row.last_synced_at)
          setSyncError(row.sync_error)
        },
      )
      .subscribe()

    return () => {
      void supabaseClient.removeChannel(channel)
    }
  }, [userId])

  return { syncStatus, lastSyncedAt, syncError }
}
