import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import ScoreBadge from '@/components/ScoreBadge'
import type { InstagramMediaWithInsights } from '@/types/database'
import type { ComputedScore } from '@/types/scoring'

interface PostCardProps {
  post: InstagramMediaWithInsights
  score?: ComputedScore
}

function formatBadge(post: InstagramMediaWithInsights): { label: string; color: string } {
  if (post.is_reel) return { label: 'Reel', color: 'bg-purple-100 text-purple-700' }
  if (post.media_type === 'CAROUSEL_ALBUM') return { label: 'Carousel', color: 'bg-blue-100 text-blue-700' }
  if (post.media_type === 'VIDEO') return { label: 'Video', color: 'bg-teal-100 text-teal-700' }
  return { label: 'Image', color: 'bg-gray-100 text-gray-600' }
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function PostCard({ post, score }: PostCardProps) {
  const badge = formatBadge(post)
  const thumbnail = post.thumbnail_url ?? post.media_url
  const relativeDate = formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })

  return (
    <Link
      to={`/posts/${post.id}`}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-brand-300 hover:shadow-sm transition-all flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-gray-100 flex-shrink-0 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={post.caption?.slice(0, 60) ?? 'Instagram post'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {post.is_reel ? '🎬' : post.media_type === 'CAROUSEL_ALBUM' ? '📷' : '🖼️'}
          </div>
        )}

        {/* Format badge */}
        <span
          className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        {/* Caption */}
        <p className="text-xs text-gray-700 line-clamp-2 flex-1 mb-2">
          {post.caption ?? <span className="italic text-gray-400">No caption</span>}
        </p>

        {/* Date + reach */}
        <p className="text-xs text-gray-400 mb-2">
          {relativeDate}
          {post.insights && (
            <>
              {' · '}
              <span className="text-gray-500 font-medium">
                {formatNum(post.insights.reach)}
              </span>
              {' reach'}
            </>
          )}
        </p>

        {/* Metrics row + score badge */}
        <div className="flex items-center justify-between gap-2">
          {post.insights ? (
            <div className="flex gap-1.5">
              <span className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 text-gray-600">
                💾 {formatNum(post.insights.saves)}
              </span>
              <span className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 text-gray-600">
                ↗ {formatNum(post.insights.shares)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">No insights</span>
          )}
          {score != null && (
            <ScoreBadge score={score.totalScore} size={36} />
          )}
        </div>
      </div>
    </Link>
  )
}
