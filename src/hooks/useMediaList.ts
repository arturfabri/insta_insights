import { useEffect, useState, useCallback } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MediaType, InstagramMediaWithInsights } from '@/types/database'

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

      // The insights column is fetched via a foreign key join using the alias
      // pattern supported by Supabase PostgREST: table_name!fk_column(*)
      let query = supabaseClient
        .from('instagram_media')
        .select('*, insights:instagram_media_insights(*)')
        .eq('user_id', userId)

      if (mediaType) {
        query = query.eq('media_type', mediaType)
      }

      // engagement_rate and reach live in the joined insights table —
      // Supabase doesn't support sorting on joined columns directly, so
      // we sort in JavaScript for non-timestamp sorts.
      if (sortBy === 'timestamp') {
        query = query.order('timestamp', { ascending: false })
      } else {
        // Fetch all (up to limit * 3 to account for nulls) and sort client-side
        query = query.order('timestamp', { ascending: false }).limit(limit * 3)
      }

      if (sortBy === 'timestamp') {
        query = query.limit(limit)
      }

      const { data, error: dbError } = await query

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setMedia([])
        setLoading(false)
        return
      }

      let result = (data ?? []) as InstagramMediaWithInsights[]

      // Client-side sort for insight-derived fields
      if (sortBy === 'engagement_rate') {
        result = result
          .sort((a, b) => {
            const aRate = a.insights?.engagement_rate ?? -1
            const bRate = b.insights?.engagement_rate ?? -1
            return bRate - aRate
          })
          .slice(0, limit)
      } else if (sortBy === 'reach') {
        result = result
          .sort((a, b) => {
            const aReach = a.insights?.reach ?? 0
            const bReach = b.insights?.reach ?? 0
            return bReach - aReach
          })
          .slice(0, limit)
      }

      setMedia(result)
      setLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [trigger, userId, mediaType, sortBy, limit])

  return { media, loading, error, refetch }
}
