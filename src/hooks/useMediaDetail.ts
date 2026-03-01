import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { InstagramMediaWithInsights } from '@/types/database'

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

      const { data, error: dbError } = await supabaseClient
        .from('instagram_media')
        .select('*, insights:instagram_media_insights(*)')
        .eq('id', mediaId)
        .eq('user_id', userId) // RLS-friendly guard
        .single()

      if (cancelled) return

      if (dbError) {
        setError(dbError.message)
        setMedia(null)
      } else {
        setMedia(data as InstagramMediaWithInsights | null)
      }
      setLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [mediaId, userId])

  return { media, loading, error }
}
