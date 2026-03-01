import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useGoal } from '@/context/GoalContext'
import { useMediaList } from '@/hooks/useMediaList'
import SyncStatusBanner from '@/components/SyncStatusBanner'

export default function DashboardPage() {
  const { goal } = useGoal()
  const { media, loading, error } = useMediaList()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          Goal:{' '}
          <span className="font-medium text-brand-600">
            {goal === 'growth' ? 'Growth' : 'Leads & Sales'}
          </span>
        </span>
      </div>

      <SyncStatusBanner className="mb-6" />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Failed to load posts: {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center mt-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : media.length === 0 ? (
        /* Empty state */
        <div className="text-center mt-16">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h2>
          <p className="text-gray-500 mb-6">
            Connect your Instagram account and sync your posts to get started.
          </p>
          <Link
            to="/connect"
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Go to Connect
          </Link>
        </div>
      ) : (
        /* Post list — Phase 4 will replace this with the full PostCard grid */
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {media.length} post{media.length !== 1 ? 's' : ''} loaded
            <span className="text-xs text-gray-400 ml-2">(full grid coming in Phase 4)</span>
          </p>
          <ul className="space-y-2">
            {media.map((post) => (
              <li key={post.id}>
                <Link
                  to={`/posts/${post.id}`}
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 transition-colors"
                >
                  {/* Thumbnail */}
                  {(post.thumbnail_url ?? post.media_url) ? (
                    <img
                      src={post.thumbnail_url ?? post.media_url ?? ''}
                      alt={post.caption?.slice(0, 40) ?? 'Post thumbnail'}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">
                      {post.is_reel ? '🎬' : post.media_type === 'CAROUSEL_ALBUM' ? '📷' : '🖼️'}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {post.caption?.slice(0, 80) ?? '(no caption)'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                      {' · '}
                      <span className="capitalize">
                        {post.is_reel ? 'Reel' : post.media_type.toLowerCase().replace('_', ' ')}
                      </span>
                    </p>
                  </div>

                  {/* Reach */}
                  {post.insights && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {post.insights.reach.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">reach</p>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
