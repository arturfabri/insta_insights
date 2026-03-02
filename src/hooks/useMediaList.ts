import { useEffect, useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MediaType, InstagramMediaWithInsights } from '@/types/database'
import { parseMediaListRpcRows } from '@/types/schemas/mediaListRpc'

export interface UseMediaListParams {
  mediaType?: MediaType
  sortBy?: 'timestamp' | 'engagement_rate' | 'reach'
  limit?: number
}

interface UseMediaListResult {
  media: InstagramMediaWithInsights[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useMediaList(params: UseMediaListParams = {}): UseMediaListResult {
  const { user } = useAuth()
  const { mediaType, sortBy = 'timestamp', limit = 50 } = params

  const [media, setMedia] = useState<InstagramMediaWithInsights[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((n) => n + 1), [])

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId) {
        setMedia([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabaseClient.rpc('list_media_with_insights', {
        p_sort_by: sortBy,
        p_media_type: mediaType ?? null,
        p_is_reel: null,
        p_limit: limit,
      })

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setMedia([])
        setLoading(false)
        return
      }

      try {
        const result = parseMediaListRpcRows(data ?? [])
        setMedia(result)
      } catch (parseError) {
        const message =
          parseError instanceof Error
            ? `Invalid media payload from server: ${parseError.message}`
            : 'Invalid media payload from server'
        setError(message)
        setMedia([])
      }
      setLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [trigger, userId, mediaType, sortBy, limit])

  return { media, loading, error, refetch }
}
