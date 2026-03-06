import { useEffect, useState, useCallback } from 'react'
import { subDays, format } from 'date-fns'
import { supabaseClient } from '@/lib/supabase'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'
import { parseAccountInsightsRows } from '@/types/schemas/accountInsightsDaily'
import type { InstagramAccount, InstagramAccountInsightsDaily } from '@/types/database'

interface UseAccountInsightsResult {
  account: InstagramAccount | null
  insights: InstagramAccountInsightsDaily[]
  loading: boolean
  error: string | null
  refetch: () => void
}

const HISTORY_WINDOW_DAYS = 400

/**
 * Loads account-level daily insights for the active Instagram account.
 * The hook keeps the Supabase boundary localized and validates rows before
 * chart code consumes them.
 */
export function useAccountInsights(): UseAccountInsightsResult {
  const { account, loading: accountLoading, error: accountError } = useInstagramAccount()
  const [insights, setInsights] = useState<InstagramAccountInsightsDaily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  const refetch = useCallback(() => setTrigger((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (accountLoading) {
        setLoading(true)
        return
      }

      if (accountError) {
        setInsights([])
        setError(accountError)
        setLoading(false)
        return
      }

      if (!account) {
        setInsights([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const cutoffDate = format(subDays(new Date(), HISTORY_WINDOW_DAYS), 'yyyy-MM-dd')
      const { data, error: dbError } = await supabaseClient
        .from('instagram_account_insights_daily')
        .select(
          'account_id,user_id,metric_date,metric_type,timeframe,accounts_engaged,reach,views,total_interactions,likes,comments,replies,shares,saves,reposts,profile_links_taps,follows,unfollows,net_follower_growth,updated_at',
        )
        .eq('account_id', account.id)
        .eq('timeframe', '')
        .gte('metric_date', cutoffDate)
        .order('metric_date', { ascending: true })
        .limit(1000)

      if (cancelled) return

      if (dbError) {
        setInsights([])
        setError(dbError.message)
        setLoading(false)
        return
      }

      try {
        setInsights(parseAccountInsightsRows(data ?? []))
      } catch (parseError) {
        const message =
          parseError instanceof Error
            ? `Invalid account insights payload from server: ${parseError.message}`
            : 'Invalid account insights payload from server'
        setInsights([])
        setError(message)
      }

      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [account, accountError, accountLoading, trigger])

  return { account, insights, loading, error, refetch }
}
