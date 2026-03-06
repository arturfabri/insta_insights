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

type DetailFormat = 'number' | 'percent' | 'dateTime' | 'durationSeconds' | 'durationMilliseconds' | 'text'

interface DetailItem {
  label: string
  value: boolean | number | string | null
  format?: DetailFormat
  emptyLabel?: string
}

interface DetailSection {
  title: string
  items: DetailItem[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function computeMedians(media: InstagramMediaWithInsights[]) {
  const withIns = media.filter(m => m.insights != null)
  return {
    reach: median(withIns.map(m => m.insights!.reach)),
    saves: median(withIns.map(m => m.insights!.saves)),
    shares: median(withIns.map(m => m.insights!.shares)),
    comments: median(withIns.map(m => m.insights!.comments)),
    follows: median(withIns.map(m => m.insights!.follows)),
    profileVisits: median(withIns.map(m => m.insights!.profile_visits)),
    engagementRate: median(withIns.map(m => m.insights!.engagement_rate ?? 0)),
  }
}

function formatBadge(post: InstagramMediaWithInsights) {
  if (post.is_reel) return 'Reel'
  if (post.media_type === 'CAROUSEL_ALBUM') return 'Carousel'
  if (post.media_type === 'VIDEO') return 'Video'
  return 'Image'
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDurationFromSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.round(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function formatDurationFromMilliseconds(value: number) {
  const totalSeconds = value / 1000
  return formatDurationFromSeconds(totalSeconds)
}

function formatDetailValue({ value, format: valueFormat = 'text', emptyLabel = 'Unavailable' }: DetailItem) {
  if (value == null) return emptyLabel
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  switch (valueFormat) {
    case 'number':
      return typeof value === 'number' ? formatCompactNumber(value) : value
    case 'percent':
      return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value
    case 'dateTime':
      return typeof value === 'string' ? format(new Date(value), 'PPP p') : value
    case 'durationSeconds':
      return typeof value === 'number' ? formatDurationFromSeconds(value) : value
    case 'durationMilliseconds':
      return typeof value === 'number' ? formatDurationFromMilliseconds(value) : value
    case 'text':
    default:
      return String(value)
  }
}

function buildDetailSections(media: InstagramMediaWithInsights): DetailSection[] {
  const insights = media.insights

  return [
    {
      title: 'Media Overview',
      items: [
        { label: 'Display type', value: formatBadge(media) },
        { label: 'Instagram media ID', value: media.media_id },
        { label: 'Media type', value: media.media_type },
        { label: 'Is reel', value: media.is_reel },
        { label: 'Product type', value: media.media_product_type, emptyLabel: '—' },
        { label: 'Published at', value: media.timestamp, format: 'dateTime' },
        { label: 'Duration', value: media.duration_seconds, format: 'durationSeconds', emptyLabel: '—' },
        { label: 'Permalink', value: media.permalink, emptyLabel: '—' },
        { label: 'Created at', value: media.created_at, format: 'dateTime' },
        { label: 'Updated at', value: media.updated_at, format: 'dateTime' },
      ],
    },
    {
      title: 'Core Insights',
      items: [
        { label: 'Reach', value: insights?.reach ?? null, format: 'number' },
        { label: 'Impressions', value: insights?.impressions ?? null, format: 'number' },
        { label: 'Plays', value: insights?.plays ?? null, format: 'number' },
        { label: 'Video views', value: insights?.video_views ?? null, format: 'number' },
        { label: 'Views', value: insights?.views ?? null, format: 'number' },
        { label: 'Likes', value: insights?.likes ?? null, format: 'number' },
        { label: 'Comments', value: insights?.comments ?? null, format: 'number' },
        { label: 'Shares', value: insights?.shares ?? null, format: 'number' },
        { label: 'Saves', value: insights?.saves ?? null, format: 'number' },
        { label: 'Engagement rate', value: insights?.engagement_rate ?? null, format: 'percent' },
      ],
    },
    {
      title: 'Advanced Insights',
      items: [
        { label: 'Total interactions', value: insights?.total_interactions ?? null, format: 'number' },
        { label: 'Profile activity', value: insights?.profile_activity ?? null, format: 'number' },
        { label: 'Replies', value: insights?.replies ?? null, format: 'number' },
        { label: 'Reposts', value: insights?.reposts ?? null, format: 'number' },
        { label: 'Profile visits', value: insights?.profile_visits ?? null, format: 'number' },
        { label: 'Follows', value: insights?.follows ?? null, format: 'number' },
        { label: 'Reels skip rate', value: insights?.reels_skip_rate ?? null, format: 'percent' },
        { label: 'Completion rate', value: insights?.completion_rate ?? null, format: 'percent' },
        { label: 'Average watch time', value: insights?.avg_watch_time_sec ?? null, format: 'durationSeconds' },
        { label: 'Total watch time', value: insights?.total_watch_time_ms ?? null, format: 'durationMilliseconds' },
        { label: 'Crossposted views', value: insights?.crossposted_views ?? null, format: 'number' },
        { label: 'Facebook views', value: insights?.facebook_views ?? null, format: 'number' },
      ],
    },
    {
      title: 'Sync / Data Status',
      items: [
        { label: 'Insights present', value: Boolean(insights) },
        { label: 'Last insight sync', value: insights?.synced_at ?? null, format: 'dateTime' },
        {
          label: 'Unavailable fields',
          value: insights == null
            ? 'Insights unavailable for this post.'
            : [
                insights.plays == null ? 'plays' : null,
                insights.video_views == null ? 'video views' : null,
                insights.views == null ? 'views' : null,
                insights.total_interactions == null ? 'total interactions' : null,
                insights.profile_activity == null ? 'profile activity' : null,
                insights.replies == null ? 'replies' : null,
                insights.reposts == null ? 'reposts' : null,
                insights.reels_skip_rate == null ? 'reels skip rate' : null,
                insights.crossposted_views == null ? 'crossposted views' : null,
                insights.facebook_views == null ? 'facebook views' : null,
                insights.completion_rate == null ? 'completion rate' : null,
                insights.avg_watch_time_sec == null ? 'average watch time' : null,
                insights.total_watch_time_ms == null ? 'total watch time' : null,
                insights.engagement_rate == null ? 'engagement rate' : null,
              ].filter(Boolean).join(', ') || 'None',
        },
      ],
    },
  ]
}

/**
 * Read-only detail section for grouped media metadata and insight fields.
 * The page shows null metrics explicitly so operators can separate unsupported
 * provider fields from genuinely low-performing values.
 */
function DetailSectionCard({ section }: { section: DetailSection }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{section.title}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {section.items.map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</dt>
            <dd className="mt-1 text-sm text-gray-900 break-words">
              {formatDetailValue(item)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Post detail screen for a single media row plus its joined insight payload.
 * It keeps the preview-first layout but surfaces the full RPC contract so
 * null provider fields remain visible during debugging and QA.
 */
export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { media, loading, error } = useMediaDetail(id)
  const { media: allMedia } = useMediaList({ limit: 200 })

  const singleMediaArr = useMemo(() => (media ? [media] : []), [media])
  const scores = useScoringEngine(singleMediaArr)
  usePersistScores(scores)
  const score = media ? scores.get(media.id) : undefined

  const medians = useMemo(() => computeMedians(allMedia), [allMedia])

  const metrics: MetricItem[] = useMemo(() => {
    const ins = media?.insights
    if (!ins) return []
    return [
      { label: 'Reach', icon: '👁', value: ins.reach, median: medians.reach },
      { label: 'Saves', icon: '💾', value: ins.saves, median: medians.saves },
      { label: 'Shares', icon: '↗', value: ins.shares, median: medians.shares },
      { label: 'Comments', icon: '💬', value: ins.comments, median: medians.comments },
      { label: 'Follows', icon: '➕', value: ins.follows, median: medians.follows },
      { label: 'Profile visits', icon: '🔍', value: ins.profile_visits, median: medians.profileVisits },
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

  const detailSections = useMemo(() => (media ? buildDetailSections(media) : []), [media])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="aspect-square bg-gray-200 rounded-xl animate-pulse mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

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
    <div className="max-w-5xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        ← Dashboard
      </Link>

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

      {metrics.length > 0 && (
        <section className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Headline Metrics</h2>
          <MetricsGrid metrics={metrics} />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {detailSections.map((section) => (
          <DetailSectionCard key={section.title} section={section} />
        ))}
      </div>

      {score && (
        <section className="mb-6">
          <ScoreBreakdown score={score} isReel={media.is_reel} />
        </section>
      )}
    </div>
  )
}
