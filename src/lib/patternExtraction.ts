/**
 * Pattern extraction — compares top 20% vs bottom 20% of posts by score
 * to surface actionable content patterns.
 */

import type { InstagramMediaWithInsights } from '@/types/database'
import type { ComputedScore } from '@/types/scoring'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatternAnalysis {
  topPostCount: number
  bottomPostCount: number
  /** Format distribution (%) for the top-20% posts */
  topFormatMix: Record<string, number>
  avgCaptionWords: { top: number; bottom: number }
  avgHashtagCount: { top: number; bottom: number }
  /** Percentage of posts that include at least one CTA keyword */
  ctaPct: { top: number; bottom: number }
  /** Duration distribution for top-performing Reels */
  reelDurationBuckets: Array<{ label: string; count: number }>
  /** Posting-time distribution for top-performing posts */
  postingTimeBuckets: Array<{ label: string; count: number }>
  /** Up to 5 human-readable insight bullets */
  patterns: string[]
  /** One-sentence summary suitable for the AI prompt */
  summary: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CTA_KEYWORDS = [
  'dm', 'comment', 'link in bio', 'free', 'download',
  'guide', 'template', 'save', 'share', 'tag a friend',
]

const REEL_DURATION_LABELS = ['0-15s', '16-30s', '31-60s', '61-90s', '90s+']

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function countHashtags(text: string): number {
  return (text.match(/#\w+/g) ?? []).length
}

export function hasCTA(caption: string | null): boolean {
  if (!caption) return false
  const lower = caption.toLowerCase()
  return CTA_KEYWORDS.some(kw => lower.includes(kw))
}

export function reelDurationLabel(seconds: number | null): string | null {
  if (seconds == null) return null
  if (seconds <= 15)  return '0-15s'
  if (seconds <= 30)  return '16-30s'
  if (seconds <= 60)  return '31-60s'
  if (seconds <= 90)  return '61-90s'
  return '90s+'
}

export function postingTimeLabel(isoTimestamp: string): string {
  const hour = new Date(isoTimestamp).getHours()
  if (hour >= 6  && hour < 12) return 'morning (6–11am)'
  if (hour >= 12 && hour < 17) return 'afternoon (12–4pm)'
  if (hour >= 17 && hour < 22) return 'evening (5–9pm)'
  return 'night (10pm–5am)'
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

function formatLabel(post: InstagramMediaWithInsights): string {
  if (post.is_reel)                           return 'Reel'
  if (post.media_type === 'CAROUSEL_ALBUM')   return 'Carousel'
  if (post.media_type === 'VIDEO')            return 'Video'
  return 'Image'
}

function formatMix(posts: InstagramMediaWithInsights[]): Record<string, number> {
  if (posts.length === 0) return {}
  const counts: Record<string, number> = {}
  for (const p of posts) {
    const key = formatLabel(p)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, pct(v, posts.length)])
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

/** Empty result returned when there's not enough data */
const EMPTY: PatternAnalysis = {
  topPostCount: 0, bottomPostCount: 0, topFormatMix: {},
  avgCaptionWords: { top: 0, bottom: 0 }, avgHashtagCount: { top: 0, bottom: 0 },
  ctaPct: { top: 0, bottom: 0 }, reelDurationBuckets: [], postingTimeBuckets: [],
  patterns: [], summary: 'Not enough data yet — sync more posts to unlock insights.',
}

export function extractPatterns(
  media: InstagramMediaWithInsights[],
  scores: Map<string, ComputedScore>,
): PatternAnalysis {
  // Only include posts that have been scored and have insights
  const scored = media
    .filter(m => scores.has(m.id) && m.insights != null)
    .sort((a, b) => (scores.get(b.id)?.totalScore ?? 0) - (scores.get(a.id)?.totalScore ?? 0))

  if (scored.length < 5) return EMPTY

  const cutoff = Math.max(1, Math.ceil(scored.length * 0.2))
  const top    = scored.slice(0, cutoff)
  const bottom = scored.slice(-cutoff)

  // ── Caption stats ──────────────────────────────────────────────────────────
  const avgCaptionWords = {
    top:    avg(top.map(p => countWords(p.caption ?? ''))),
    bottom: avg(bottom.map(p => countWords(p.caption ?? ''))),
  }
  const avgHashtagCount = {
    top:    avg(top.map(p => countHashtags(p.caption ?? ''))),
    bottom: avg(bottom.map(p => countHashtags(p.caption ?? ''))),
  }
  const ctaPct = {
    top:    pct(top.filter(p => hasCTA(p.caption)).length,    top.length),
    bottom: pct(bottom.filter(p => hasCTA(p.caption)).length, bottom.length),
  }

  // ── Reel duration buckets (top posts) ─────────────────────────────────────
  const topReels = top.filter(p => p.is_reel)
  const reelBucketCounts: Record<string, number> = {}
  for (const reel of topReels) {
    const label = reelDurationLabel(reel.duration_seconds)
    if (label) reelBucketCounts[label] = (reelBucketCounts[label] ?? 0) + 1
  }
  const reelDurationBuckets = REEL_DURATION_LABELS
    .filter(l => reelBucketCounts[l])
    .map(l => ({ label: l, count: reelBucketCounts[l] }))

  // ── Posting time (top posts) ───────────────────────────────────────────────
  const timeCounts: Record<string, number> = {}
  for (const p of top) {
    const label = postingTimeLabel(p.timestamp)
    timeCounts[label] = (timeCounts[label] ?? 0) + 1
  }
  const postingTimeBuckets = Object.entries(timeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }))

  // ── Patterns ───────────────────────────────────────────────────────────────
  const topFormatMix = formatMix(top)
  const patterns: string[] = []

  // Top format
  const topFormat = Object.entries(topFormatMix).sort((a, b) => b[1] - a[1])[0]
  if (topFormat) {
    patterns.push(`${topFormat[1]}% of top posts are ${topFormat[0]}s`)
  }

  // Caption length
  if (avgCaptionWords.top > avgCaptionWords.bottom * 1.3) {
    patterns.push(
      `Top posts use longer captions (~${avgCaptionWords.top} words vs ~${avgCaptionWords.bottom})`
    )
  } else if (avgCaptionWords.bottom > avgCaptionWords.top * 1.3) {
    patterns.push(
      `Top posts use shorter captions (~${avgCaptionWords.top} words vs ~${avgCaptionWords.bottom})`
    )
  }

  // CTA
  if (ctaPct.top >= ctaPct.bottom + 20) {
    patterns.push(
      `${ctaPct.top}% of top posts include a CTA (vs ${ctaPct.bottom}% of low performers)`
    )
  }

  // Reel duration
  if (reelDurationBuckets[0] && topReels.length >= 3) {
    patterns.push(`Top Reels are most commonly ${reelDurationBuckets[0].label} long`)
  }

  // Posting time
  if (postingTimeBuckets[0]) {
    patterns.push(`Top posts are most often published in the ${postingTimeBuckets[0].label}`)
  }

  // Hashtags
  if (Math.abs(avgHashtagCount.top - avgHashtagCount.bottom) >= 3) {
    if (avgHashtagCount.top > avgHashtagCount.bottom) {
      patterns.push(`Top posts use more hashtags (~${avgHashtagCount.top} vs ~${avgHashtagCount.bottom})`)
    } else {
      patterns.push(`Top posts use fewer hashtags (~${avgHashtagCount.top} vs ~${avgHashtagCount.bottom})`)
    }
  }

  const finalPatterns = patterns.slice(0, 5)

  // ── Summary ────────────────────────────────────────────────────────────────
  const summaryParts: string[] = []
  if (topFormat) summaryParts.push(`${topFormat[0]}s`)
  if (reelDurationBuckets[0] && topReels.length >= 3) {
    summaryParts.push(`under ${reelDurationBuckets[0].label}`)
  }
  if (ctaPct.top > 50) summaryParts.push(`a CTA (e.g. "save" or "share")`)
  if (postingTimeBuckets[0]) {
    summaryParts.push(`posted in the ${postingTimeBuckets[0].label}`)
  }

  const summary = summaryParts.length > 0
    ? `High-performing posts tend to be ${summaryParts.join(', ')}.`
    : `Not enough variation across ${scored.length} posts to identify clear patterns yet.`

  return {
    topPostCount: top.length,
    bottomPostCount: bottom.length,
    topFormatMix,
    avgCaptionWords,
    avgHashtagCount,
    ctaPct,
    reelDurationBuckets,
    postingTimeBuckets,
    patterns: finalPatterns,
    summary,
  }
}
