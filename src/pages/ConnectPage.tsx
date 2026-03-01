import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import SyncStatusBanner from '@/components/SyncStatusBanner'
import { supabaseClient } from '@/lib/supabase'

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string

const SYNC_PERIODS = [
  { days: 90,  label: '90 days' },
  { days: 180, label: '180 days' },
  { days: 360, label: '360 days' },
] as const

type SyncPeriodDays = 90 | 180 | 360

const PERIOD_STORAGE_KEY = 'insta_insights_sync_period'
/** Sync locks older than this are considered stale (Edge Function timed out) */
const STALE_SYNC_MS = 10 * 60 * 1000 // 10 minutes

function readStoredPeriod(): SyncPeriodDays {
  const stored = parseInt(localStorage.getItem(PERIOD_STORAGE_KEY) ?? '', 10)
  return ([90, 180, 360] as const).includes(stored as SyncPeriodDays)
    ? (stored as SyncPeriodDays)
    : 90
}

function buildOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: `${window.location.origin}/oauth/callback`,
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    response_type: 'code',
    enable_fb_login: '0',
  })
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

export default function ConnectPage() {
  const { account, loading, refetch } = useInstagramAccount()
  const { syncStatus } = useSyncStatus()
  const [syncing, setSyncing] = useState(false)
  const [syncInvokeError, setSyncInvokeError] = useState<string | null>(null)
  const [syncPeriod, setSyncPeriodState] = useState<SyncPeriodDays>(readStoredPeriod)

  const setSyncPeriod = (days: SyncPeriodDays) => {
    localStorage.setItem(PERIOD_STORAGE_KEY, String(days))
    setSyncPeriodState(days)
  }

  const lastSynced = useMemo(
    () =>
      account?.last_synced_at
        ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
        : 'Never',
    [account]
  )

  const tokenWarning = useMemo(() => {
    if (!account) return false
    const fourteenDaysFromNow = new Date()
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14)
    return new Date(account.token_expires_at) < fourteenDaysFromNow
  }, [account])

  // True when sync_status has been 'syncing' for more than 10 minutes,
  // which means the Edge Function timed out without updating the status.
  const isStaleSyncing = useMemo(() => {
    if (syncStatus !== 'syncing' || !account) return false
    return Date.now() - new Date(account.updated_at).getTime() > STALE_SYNC_MS
  }, [syncStatus, account])

  // Trigger a sync via the Edge Function
  const invokeSync = useCallback(async () => {
    if (!account || syncing) return
    // Block while an active (non-stale) sync is running
    if (syncStatus === 'syncing' && !isStaleSyncing) return
    setSyncing(true)
    setSyncInvokeError(null)
    try {
      const { error } = await supabaseClient.functions.invoke('instagram-sync', {
        body: { accountId: account.id, syncPeriodDays: syncPeriod },
      })
      if (error) {
        // error.message is always the generic Supabase wrapper text.
        // Read the actual response body to surface the real reason.
        let detail = 'Sync request failed'
        try {
          const body = await (error.context as Response).text()
          const parsed = JSON.parse(body) as { error?: string; details?: string }
          if (parsed.details) detail = parsed.details
          else if (parsed.error) detail = parsed.error
        } catch {
          detail = error.message ?? 'Sync request failed'
        }
        setSyncInvokeError(detail)
      } else {
        // Refetch account so the UI picks up the updated sync_status
        refetch()
      }
    } catch (err) {
      setSyncInvokeError(err instanceof Error ? err.message : 'Sync request failed')
    } finally {
      setSyncing(false)
    }
  }, [account, syncing, syncStatus, isStaleSyncing, syncPeriod, refetch])

  // Auto-trigger initial sync when account is newly connected (never synced)
  useEffect(() => {
    if (account && !account.last_synced_at && syncStatus !== 'syncing') {
      void invokeSync()
    }
  // Only run once when account first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-16 flex justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (account) {
    // isSyncing controls button/pill disabled state.
    // A stale sync is NOT treated as active — we want UI controls enabled.
    const isSyncing = syncing || (syncStatus === 'syncing' && !isStaleSyncing)

    return (
      <div className="max-w-lg mx-auto mt-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Instagram Account</h1>

        {isStaleSyncing ? (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <span className="shrink-0">⚠️</span>
            <span className="flex-1">
              Sync seems stuck — the previous attempt may have timed out.
            </span>
            <button
              onClick={invokeSync}
              disabled={syncing}
              className="shrink-0 font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
            >
              {syncing ? 'Retrying…' : 'Force retry'}
            </button>
          </div>
        ) : (
          <SyncStatusBanner onRetry={invokeSync} className="mb-4" />
        )}

        {syncInvokeError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {syncInvokeError}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Account header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
              @
            </div>
            <div>
              <p className="font-semibold text-gray-900">@{account.username}</p>
              <p className="text-sm text-gray-500">Connected</p>
            </div>
            <span
              className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                syncStatus === 'complete' || account.sync_status === 'complete'
                  ? 'bg-green-100 text-green-700'
                  : syncStatus === 'syncing' || account.sync_status === 'syncing'
                  ? 'bg-blue-100 text-blue-700'
                  : syncStatus === 'error' || account.sync_status === 'error'
                  ? 'bg-red-100 text-red-700'
                  : syncStatus === 'partial' || account.sync_status === 'partial'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {syncStatus ?? account.sync_status}
            </span>
          </div>

          {/* Sync period selector */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Sync window</p>
            <div className="flex gap-2">
              {SYNC_PERIODS.map(({ days, label }) => (
                <button
                  key={days}
                  onClick={() => setSyncPeriod(days)}
                  disabled={isSyncing}
                  className={`flex-1 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    syncPeriod === days
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {syncPeriod === 360
                ? 'Up to 400 posts — large accounts may need multiple sync runs.'
                : syncPeriod === 180
                ? 'Up to 400 posts from the last 6 months.'
                : 'Up to 400 posts from the last 3 months.'}
            </p>
          </div>

          {/* Last synced + Sync now */}
          <div className="text-sm text-gray-500 border-t border-gray-100 pt-4 flex items-center justify-between">
            <span>Last synced: {lastSynced}</span>
            <button
              onClick={invokeSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <>
                  <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Syncing…
                </>
              ) : (
                'Sync now'
              )}
            </button>
          </div>

          {tokenWarning && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              ⚠️ Your Instagram connection expires soon. Reconnect to keep your data syncing.
            </div>
          )}

          {account.sync_error && syncStatus !== 'syncing' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Sync error: {account.sync_error}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 mt-4 text-center">
          Need to reconnect?{' '}
          <a
            href={buildOAuthUrl()}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            Connect again
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">📸</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Instagram</h1>
      <p className="text-gray-500 mb-8">
        Connect your Creator or Business account to start analysing your posts.
      </p>

      <a
        href={buildOAuthUrl()}
        className="inline-flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors"
      >
        Connect Instagram account
      </a>

      <p className="text-xs text-gray-400 mt-4">
        You&apos;ll be redirected to Instagram to authorise access.
        We only read your posts and insights — we never post on your behalf.
      </p>
    </div>
  )
}
