/**
 * RecommendationsPage — Phase 5.
 *
 * Layout:
 *  1. Top Performers grid (top 20% by score, max 8)
 *  2. PatternSummaryCard
 *  3. BriefGeneratorForm
 *  4. Generated ContentBriefCards (wrapped in #pdf-export-content for PDF)
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMediaList } from '@/hooks/useMediaList'
import { useScoringEngine } from '@/hooks/useScoringEngine'
import { usePersistScores } from '@/hooks/usePersistScores'
import { useInstagramAccount } from '@/hooks/useInstagramAccount'
import { useGoal } from '@/context/GoalContext'
import { extractPatterns } from '@/lib/patternExtraction'
import PatternSummaryCard from '@/components/PatternSummaryCard'
import BriefGeneratorForm from '@/components/BriefGeneratorForm'
import ContentBriefCard from '@/components/ContentBriefCard'
import ExportMenu from '@/components/ExportMenu'
import PostCard from '@/components/PostCard'
import type { ContentBrief } from '@/types/database'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Build a compact summary string for each top post (fed to the AI briefer). */
function buildPostSummary(post: { caption: string | null; is_reel: boolean; media_type: string; duration_seconds: number | null; insights: { reach: number; saves: number; shares: number; engagement_rate: number | null } | null }): string {
  const format = post.is_reel
    ? `Reel${post.duration_seconds ? ` (${post.duration_seconds}s)` : ''}`
    : post.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Image'
  const caption = post.caption ? `"${post.caption.slice(0, 80).replace(/\n/g, ' ')}"` : '(no caption)'
  const ins = post.insights
  const stats = ins
    ? `reach ${formatNum(ins.reach)}, saves ${ins.saves}, shares ${ins.shares}${ins.engagement_rate != null ? `, ER ${(ins.engagement_rate * 100).toFixed(1)}%` : ''}`
    : 'no metrics'
  return `${format}: ${caption} — ${stats}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="h-40 bg-gray-200 rounded-xl" />
      <div className="h-28 bg-gray-200 rounded-xl" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const { goal } = useGoal()
  const { account } = useInstagramAccount()
  const { media, loading } = useMediaList({ limit: 200 })
  const scores = useScoringEngine(media)
  usePersistScores(scores)

  const [generatedBriefs, setGeneratedBriefs] = useState<ContentBrief[]>([])

  // ── Pattern extraction ─────────────────────────────────────────────────────
  const analysis = useMemo(() => extractPatterns(media, scores), [media, scores])

  // ── Top performers (top 20%, max 8) ───────────────────────────────────────
  const topPosts = useMemo(() => {
    const scored = media
      .filter(m => scores.has(m.id) && m.insights != null)
      .sort((a, b) => (scores.get(b.id)?.totalScore ?? 0) - (scores.get(a.id)?.totalScore ?? 0))
    const cutoff = Math.max(1, Math.ceil(scored.length * 0.2))
    return scored.slice(0, Math.min(cutoff, 8))
  }, [media, scores])

  // ── Top post summaries (for AI prompt) ────────────────────────────────────
  const topPostSummaries = useMemo(
    () => topPosts.map(buildPostSummary),
    [topPosts],
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />

  // ── Empty — no data yet ────────────────────────────────────────────────────
  if (media.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center mt-16 px-4">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">No posts synced yet</h2>
        <p className="text-sm text-gray-500 mb-6">
          Connect your Instagram business account through Meta Business Login to unlock pattern analysis and AI-generated content briefs.
        </p>
        <Link
          to="/connect"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          → Go to Connect
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Recommendations</h1>
        {generatedBriefs.length > 0 && (
          <ExportMenu briefs={generatedBriefs} goal={goal} />
        )}
      </div>

      {/* ── Top Performers ─────────────────────────────────────────────────── */}
      {topPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Top Performers</h2>
            <span className="text-xs text-gray-400">
              Top {analysis.topPostCount} of {media.length} posts
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                score={scores.get(post.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Pattern Analysis ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">What's Working</h2>
        <PatternSummaryCard analysis={analysis} />
      </section>

      {/* ── Brief Generator ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Generate Content Briefs</h2>
        <BriefGeneratorForm
          patternSummary={analysis.summary}
          topPostSummaries={topPostSummaries}
          accountId={account?.id}
          goal={goal}
          onBriefsGenerated={setGeneratedBriefs}
        />
      </section>

      {/* ── Generated Briefs ───────────────────────────────────────────────── */}
      {generatedBriefs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              {generatedBriefs.length} Brief{generatedBriefs.length !== 1 ? 's' : ''} Generated
            </h2>
            <ExportMenu briefs={generatedBriefs} goal={goal} />
          </div>

          {/* Wrap in #pdf-export-content so pdfExporter can capture it */}
          <div id="pdf-export-content" className="space-y-3 bg-white p-1">
            {generatedBriefs.map((brief, i) => (
              <ContentBriefCard key={i} brief={brief} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
