import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { useAccountCapabilities } from '@/hooks/useAccountCapabilities'
import SyncStatusBanner from '@/components/SyncStatusBanner'
import { supabaseClient } from '@/lib/supabase'
import {
  buildBusinessLoginUrl,
  deriveConnectionStatus,
} from '@/lib/account-capabilities'

const SYNC_PERIODS = [
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
  { days: 360, label: '360 days' },
] as const

type SyncPeriodDays = 90 | 180 | 360

const PERIOD_STORAGE_KEY = 'insta_insights_sync_period'
/** Sync locks older than this are treated as timed-out and can be retried. */
const STALE_SYNC_MS = 10 * 60 * 1000

function readStoredPeriod(): SyncPeriodDays {
  const stored = parseInt(localStorage.getItem(PERIOD_STORAGE_KEY) ?? '', 10)
  return ([90, 180, 360] as const).includes(stored as SyncPeriodDays)
    ? (stored as SyncPeriodDays)
    : 90
}

function syncStatusClasses(status: string | null): string {
  if (status === 'complete') return 'bg-green-100 text-green-700'
  if (status === 'syncing') return 'bg-blue-100 text-blue-700'
  if (status === 'error') return 'bg-red-100 text-red-700'
  if (status === 'partial') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

function statusCopy(status: ReturnType<typeof deriveConnectionStatus>): {
  badge: string
  description: string
  actionLabel: string
} {
  if (status === 'connected') {
    return {
      badge: 'Connected',
      description:
        'Meta Business Login is active for this account. Full-scope sync and Business Discovery are available.',
      actionLabel: 'Reconnect account',
    }
  }

  if (status === 'reconnect_required') {
    return {
      badge: 'Reconnect required',
      description:
        'This account needs a fresh Meta Business login before sync can continue with full insight coverage.',
      actionLabel: 'Reconnect account',
    }
  }

  return {
    badge: 'Not connected',
    description:
      'This account was connected before the Business Login flow was enforced and must be reconnected.',
    actionLabel: 'Reconnect account',
  }
}

export default function ConnectPage() {
  const { account, loading, error: accountError, refetch } = useInstagramAccount()
  const [syncing, setSyncing] = useState(false)
  const [syncPeriod, setSyncPeriodState] = useState<SyncPeriodDays>(readStoredPeriod)

  const { syncStatus } = useSyncStatus(account?.id)
  const {
    capabilities,
    loading: capabilitiesLoading,
    error: capabilitiesError,
    refetch: refetchCapabilities,
  } = useAccountCapabilities(account?.id)

  const connectionStatus = useMemo(
    () => deriveConnectionStatus(capabilities),
    [capabilities],
  )

  const setSyncPeriod = (days: SyncPeriodDays) => {
    localStorage.setItem(PERIOD_STORAGE_KEY, String(days))
    setSyncPeriodState(days)
  }

  const lastSynced = useMemo(
    () =>
      account?.last_synced_at
        ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
        : 'Never',
    [account],
  )

  const tokenWarning = useMemo(() => {
    if (!account) return false
    const fourteenDaysFromNow = new Date()
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14)
    return new Date(account.token_expires_at) < fourteenDaysFromNow
  }, [account])

  const isStaleSyncing = useMemo(() => {
    if (syncStatus !== 'syncing' || !account) return false
    return Date.now() - new Date(account.updated_at).getTime() > STALE_SYNC_MS
  }, [syncStatus, account])

  const connectUrl = useMemo(
    () => buildBusinessLoginUrl(account?.id ?? null),
    [account?.id],
  )

  const invokeSync = useCallback(async () => {
    if (!account || syncing || connectionStatus !== 'connected') return
    if (syncStatus === 'syncing' && !isStaleSyncing) return

    setSyncing(true)
    try {
      const { data: syncResult, error } = await supabaseClient.functions.invoke<{
        success: boolean
        postsProcessed: number
        postsUpserted: number
        insightErrors: number
        firstInsightError: string | null
        partial: boolean
      }>('instagram-sync', {
        body: { accountId: account.id, syncPeriodDays: syncPeriod },
      })

      if (error) {
        let detail = 'Sync request failed'
        try {
          const body = await (error.context as Response).text()
          const parsed = JSON.parse(body) as { error?: string; details?: string }
          if (parsed.details) detail = parsed.details
          else if (parsed.error) detail = parsed.error
        } catch {
          detail = error.message ?? 'Sync request failed'
        }
        toast.error(detail)
      } else {
        if (syncResult?.insightErrors && syncResult.insightErrors > 0) {
          console.warn(
            `[instagram-sync] ${syncResult.insightErrors} insight error(s). First: ${syncResult.firstInsightError}`,
          )
        }
        refetch()
        refetchCapabilities()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync request failed')
    } finally {
      setSyncing(false)
    }
  }, [
    account,
    connectionStatus,
    isStaleSyncing,
    refetch,
    refetchCapabilities,
    syncPeriod,
    syncStatus,
    syncing,
  ])

  useEffect(() => {
    if (!account || connectionStatus !== 'connected') return
    if (account.last_synced_at || syncStatus === 'syncing') return
    void invokeSync()
  }, [account, connectionStatus, invokeSync, syncStatus])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-16 flex justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-4 text-center">
        <div className="text-5xl mb-4">📸</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Instagram via Meta</h1>
        <p className="text-gray-500 mb-8">
          Use Meta Business Login to connect the Instagram professional account and grant the full insight scope this app needs.
        </p>

        <div className="text-left rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Before you continue</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>Your Instagram account must be a professional account linked to a Facebook Page.</li>
            <li>You must be able to approve Page access for the connected Meta business.</li>
            <li>Some demographic metrics only appear once the account has enough follower or engagement volume.</li>
          </ul>

          {accountError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Could not load your existing account: {accountError}
            </div>
          )}

          <a
            href={buildBusinessLoginUrl(null)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Continue with Meta Business Login
          </a>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          The login flow can open Facebook or Instagram, but it always uses the Meta Business permissions required for full analytics.
        </p>
      </div>
    )
  }

  const connection = statusCopy(connectionStatus)
  const isSyncing = syncing || (syncStatus === 'syncing' && !isStaleSyncing)

  if (connectionStatus !== 'connected') {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Connections</h1>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
              @
            </div>
            <div>
              <p className="font-semibold text-gray-900">@{account.username}</p>
              <p className="text-sm text-gray-500">{connection.badge}</p>
            </div>
          </div>

          {capabilitiesLoading ? (
            <p className="text-sm text-gray-500">Checking connection state…</p>
          ) : (
            <p className="text-sm text-gray-600">{connection.description}</p>
          )}

          {capabilitiesError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Could not load connection capabilities: {capabilitiesError}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Required permissions</h2>
            <p className="text-sm text-gray-600">
              This flow requests `instagram_business_basic`, `instagram_business_manage_insights`, `pages_show_list`, and `pages_read_engagement`.
            </p>
          </div>

          <a
            href={connectUrl}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            {connection.actionLabel}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto mt-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Connections</h1>

      {isStaleSyncing ? (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">
            Sync seems stuck. The previous attempt may have timed out.
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

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
            @
          </div>
          <div>
            <p className="font-semibold text-gray-900">@{account.username}</p>
            <p className="text-sm text-gray-500">Business Login active</p>
          </div>
          <span
            className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${syncStatusClasses(syncStatus ?? account.sync_status)}`}
          >
            {syncStatus ?? account.sync_status}
          </span>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Meta Business Login is active for this account. Full-scope sync and Business Discovery are available.
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
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
              ? 'Up to 400 posts. Large accounts may need multiple sync runs.'
              : syncPeriod === 180
              ? 'Up to 400 posts from the last 6 months.'
              : 'Up to 400 posts from the last 3 months.'}
          </p>
        </div>

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
            Your Business Login token expires soon. Reconnect now to keep sync and insight coverage active.
          </div>
        )}

        {account.sync_error && syncStatus !== 'syncing' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Sync error: {account.sync_error}
          </div>
        )}

        <a
          href={connectUrl}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          Reconnect account
        </a>
      </div>
    </div>
  )
}
