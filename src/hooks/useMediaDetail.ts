import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { InstagramMediaWithInsights } from '@/types/database'
import { parseMediaListRpcRows } from '@/types/schemas/mediaListRpc'

interface UseMediaDetailResult {
  media: InstagramMediaWithInsights | null
  loading: boolean
  error: string | null
}

/**
 * Fetch a single Instagram media post with its insights.
 *
 * @param mediaId - The DB UUID `id` of the instagram_media row
 *                  (not the Instagram media_id). Pass `undefined` to skip.
 */
export function useMediaDetail(mediaId: string | undefined): UseMediaDetailResult {
  const { user } = useAuth()
  const [media, setMedia] = useState<InstagramMediaWithInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!userId || !mediaId) {
        setMedia(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: dbError } = await supabaseClient.rpc('list_media_with_insights', {
        p_sort_by: 'timestamp',
        p_media_type: null,
        p_is_reel: null,
        p_limit: 1,
        p_media_row_id: mediaId,
      })

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setMedia(null)
      } else {
        try {
          const parsed = parseMediaListRpcRows(data ?? [])
          setMedia(parsed[0] ?? null)
        } catch (parseError) {
          const message =
            parseError instanceof Error
              ? `Invalid media payload from server: ${parseError.message}`
              : 'Invalid media payload from server'
          setError(message)
          setMedia(null)
        }
      }
      setLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [mediaId, userId])

  return { media, loading, error }
}
