import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string

function buildOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: `${window.location.origin}/oauth/callback`,
    scope: 'instagram_basic,instagram_manage_insights',
    response_type: 'code',
  })
  return `https://api.instagram.com/oauth/authorize?${params.toString()}`
}

export default function ConnectPage() {
  const { account, loading } = useInstagramAccount()

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

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-16 flex justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (account) {

    return (
      <div className="max-w-lg mx-auto mt-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Instagram Account</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
              @
            </div>
            <div>
              <p className="font-semibold text-gray-900">@{account.username}</p>
              <p className="text-sm text-gray-500">Connected</p>
            </div>
            <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
              account.sync_status === 'complete'
                ? 'bg-green-100 text-green-700'
                : account.sync_status === 'syncing'
                ? 'bg-blue-100 text-blue-700'
                : account.sync_status === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {account.sync_status}
            </span>
          </div>

          <div className="text-sm text-gray-500 border-t border-gray-100 pt-4">
            Last synced: {lastSynced}
          </div>

          {tokenWarning && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              ⚠️ Your Instagram connection expires soon. Reconnect to keep your data syncing.
            </div>
          )}

          {account.sync_error && (
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
