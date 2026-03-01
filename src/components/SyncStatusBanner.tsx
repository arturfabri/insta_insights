import { formatDistanceToNow } from 'date-fns'
import { useSyncStatus } from '@/hooks/useSyncStatus'

interface SyncStatusBannerProps {
  onRetry?: () => void
  className?: string
}

export default function SyncStatusBanner({ onRetry, className = '' }: SyncStatusBannerProps) {
  const { syncStatus, lastSyncedAt, syncError } = useSyncStatus()

  if (!syncStatus || syncStatus === 'pending') return null

  const baseClasses =
    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium'

  if (syncStatus === 'syncing') {
    return (
      <div
        className={`${baseClasses} bg-blue-50 border border-blue-200 text-blue-700 ${className}`}
      >
        <span
          className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"
          role="status"
          aria-label="Syncing"
        />
        <span>Syncing your posts…</span>
      </div>
    )
  }

  if (syncStatus === 'complete') {
    const timeAgo = lastSyncedAt
      ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
      : null
    return (
      <div
        className={`${baseClasses} bg-green-50 border border-green-200 text-green-700 ${className}`}
      >
        <span className="flex-shrink-0" aria-hidden>✓</span>
        <span>Synced{timeAgo ? ` · ${timeAgo}` : ''}</span>
      </div>
    )
  }

  if (syncStatus === 'partial') {
    return (
      <div
        className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700 ${className}`}
      >
        <span className="flex-shrink-0" aria-hidden>⚠️</span>
        <span className="flex-1">
          Partial sync — rate limit reached. Try again in 1 hour.
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto text-amber-700 underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div
        className={`${baseClasses} bg-red-50 border border-red-200 text-red-700 ${className}`}
      >
        <span className="flex-shrink-0" aria-hidden>✕</span>
        <span className="flex-1 truncate">
          {syncError ?? 'Sync failed. Please try again.'}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-auto flex-shrink-0 text-red-700 underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return null
}
