import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { useMediaDetail } from '@/hooks/useMediaDetail'
import { useMediaList } from '@/hooks/useMediaList'
import { useScoringEngine } from '@/hooks/useScoringEngine'
import { usePersistScores } from '@/hooks/usePersistScores'
import MetricsGrid from '@/components/MetricsGrid'
import ScoreBreakdown from '@/components/ScoreBreakdown'
import type { InstagramMediaWithInsights } from '@/types/database'
import type { MetricItem } from '@/components/MetricsGrid'

// ─── Median helper ────────────────────────────────────────────────────────────

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function computeMedians(media: InstagramMediaWithInsights[]) {
  const withIns = media.filter(m => m.insights != null)
  return {
    reach:          median(withIns.map(m => m.insights!.reach)),
    saves:          median(withIns.map(m => m.insights!.saves)),
    shares:         median(withIns.map(m => m.insights!.shares)),
    comments:       median(withIns.map(m => m.insights!.comments)),
    follows:        median(withIns.map(m => m.insights!.follows)),
    profileVisits:  median(withIns.map(m => m.insights!.profile_visits)),
    engagementRate: median(withIns.map(m => m.insights!.engagement_rate ?? 0)),
  }
}

// ─── Format badge ─────────────────────────────────────────────────────────────

function formatBadge(post: InstagramMediaWithInsights) {
  if (post.is_reel)                             return 'Reel'
  if (post.media_type === 'CAROUSEL_ALBUM')     return 'Carousel'
  if (post.media_type === 'VIDEO')              return 'Video'
  return 'Image'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { media, loading, error } = useMediaDetail(id)

  // Load all posts for median computation
  const { media: allMedia } = useMediaList({ limit: 200 })

  // Score this post (useScoringEngine needs an array)
  const singleMediaArr = useMemo(() => (media ? [media] : []), [media])
  const scores = useScoringEngine(singleMediaArr)
  usePersistScores(scores)
  const score = media ? scores.get(media.id) : undefined

  const medians = useMemo(() => computeMedians(allMedia), [allMedia])

  const metrics: MetricItem[] = useMemo(() => {
    const ins = media?.insights
    if (!ins) return []
    return [
      { label: 'Reach',           icon: '👁',  value: ins.reach,           median: medians.reach },
      { label: 'Saves',           icon: '💾',  value: ins.saves,           median: medians.saves },
      { label: 'Shares',          icon: '↗',   value: ins.shares,          median: medians.shares },
      { label: 'Comments',        icon: '💬',  value: ins.comments,        median: medians.comments },
      { label: 'Follows',         icon: '➕',  value: ins.follows,         median: medians.follows },
      { label: 'Profile visits',  icon: '🔍',  value: ins.profile_visits,  median: medians.profileVisits },
      {
        label: 'Engagement rate',
        icon: '📈',
        value: ins.engagement_rate,
        median: medians.engagementRate,
        format: 'percent',
      },
      ...(ins.avg_watch_time_sec != null
        ? [
            {
              label: 'Avg watch time',
              icon: '⏱',
              value: ins.avg_watch_time_sec,
              format: 'seconds' as const,
            } satisfies MetricItem,
          ]
        : []),
    ]
  }, [media, medians])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="aspect-square bg-gray-200 rounded-xl animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / not found ────────────────────────────────────────────────────────
  if (error || !media) {
    return (
      <div className="max-w-2xl mx-auto text-center mt-16">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Post not found</h2>
        <p className="text-sm text-gray-500 mb-6">{error ?? 'This post may have been removed.'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  const thumbnail = media.thumbnail_url ?? media.media_url

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        ← Dashboard
      </Link>

      {/* Post preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {thumbnail && (
          <div className="bg-gray-50 max-h-80 overflow-hidden">
            <img
              src={thumbnail}
              alt={media.caption?.slice(0, 60) ?? 'Post'}
              className="w-full h-80 object-cover"
            />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {formatBadge(media)}
            </span>
            <span className="text-xs text-gray-400">
              {format(new Date(media.timestamp), 'PPP')}
              {' · '}
              {formatDistanceToNow(new Date(media.timestamp), { addSuffix: true })}
            </span>
            {media.permalink && (
              <a
                href={media.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                View on Instagram ↗
              </a>
            )}
          </div>
          {media.caption && (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {media.caption}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Metrics</h2>
          <MetricsGrid metrics={metrics} />
        </section>
      )}

      {/* Score breakdown */}
      {score && (
        <section className="mb-6">
          <ScoreBreakdown score={score} isReel={media.is_reel} />
        </section>
      )}
    </div>
  )
}
