import { useReducer, useMemo } from 'react'
import { useGoal } from '@/context/GoalContext'
import { useMediaList } from '@/hooks/useMediaList'
import { useScoringEngine } from '@/hooks/useScoringEngine'
import { usePersistScores } from '@/hooks/usePersistScores'
import SyncStatusBanner from '@/components/SyncStatusBanner'
import FilterBar from '@/components/FilterBar'
import { filterReducer, INITIAL_FILTER_STATE } from '@/lib/filterState'
import PostCard from '@/components/PostCard'
import EmptyState from '@/components/EmptyState'
import LoadingState from '@/components/LoadingState'
import type { MediaType } from '@/types/database'

export default function DashboardPage() {
  const { goal } = useGoal()
  const [filterState, dispatch] = useReducer(filterReducer, INITIAL_FILTER_STATE)

  // Map filter → useMediaList params
  // 'reel' filter: fetch all VIDEO, then filter client-side by is_reel
  const mediaTypeParam: MediaType | undefined =
    filterState.mediaTypeFilter === 'IMAGE'            ? 'IMAGE'
    : filterState.mediaTypeFilter === 'CAROUSEL_ALBUM' ? 'CAROUSEL_ALBUM'
    : filterState.mediaTypeFilter === 'reel'           ? 'VIDEO'
    : undefined // 'all'

  // For score-based sorting we need all posts scored → higher limit.
  const listLimit = filterState.sortBy === 'score' ? 200 : 100

  // useMediaList handles 'reach' and 'engagement_rate' sorts internally.
  // For 'score' we pass 'timestamp' and sort client-side after scoring.
  const listSortBy =
    filterState.sortBy === 'score' ? 'timestamp' : filterState.sortBy

  const { media: rawMedia, loading, error } = useMediaList({
    mediaType: mediaTypeParam,
    sortBy: listSortBy,
    limit: listLimit,
  })

  // Apply client-side reel filter (is_reel) when mediaTypeFilter === 'reel'
  const media = useMemo(() => {
    if (filterState.mediaTypeFilter === 'reel') {
      return rawMedia.filter(m => m.is_reel)
    }
    return rawMedia
  }, [rawMedia, filterState.mediaTypeFilter])

  // Score and persist
  const scores = useScoringEngine(media)
  usePersistScores(scores)

  // Sort by score client-side when requested
  const displayMedia = useMemo(() => {
    if (filterState.sortBy !== 'score') return media
    return [...media].sort((a, b) => {
      const aScore = scores.get(a.id)?.totalScore ?? -1
      const bScore = scores.get(b.id)?.totalScore ?? -1
      return bScore - aScore
    })
  }, [media, scores, filterState.sortBy])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500 hidden sm:block">
          Goal:{' '}
          <span className="font-medium text-brand-600">
            {goal === 'growth' ? 'Growth' : 'Leads & Sales'}
          </span>
        </span>
      </div>

      <SyncStatusBanner className="mb-5" />

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Failed to load posts: {error}
        </div>
      )}

      {/* Filter bar — shown even while loading so layout doesn't jump */}
      {!error && (
        <FilterBar
          state={filterState}
          dispatch={dispatch}
          totalCount={loading ? undefined : displayMedia.length}
        />
      )}

      {loading ? (
        <LoadingState count={8} />
      ) : displayMedia.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No posts yet"
          description="Connect your Instagram account and sync your posts to get started."
          action={{ label: 'Go to Connect', href: '/connect' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayMedia.map(post => (
            <PostCard
              key={post.id}
              post={post}
              score={scores.get(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
