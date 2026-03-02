import { describe, it, expect } from 'vitest'
import {
  countWords,
  countHashtags,
  hasCTA,
  reelDurationLabel,
  postingTimeLabel,
  extractPatterns,
} from './patternExtraction'
import type { InstagramMediaWithInsights } from '@/types/database'
import type { ComputedScore } from '@/types/scoring'

// ─── Unit helpers ─────────────────────────────────────────────────────────────

describe('countWords', () => {
  it('returns 0 for empty string', () => expect(countWords('')).toBe(0))
  it('counts space-separated words', () => expect(countWords('hello world foo')).toBe(3))
  it('trims leading/trailing whitespace', () => expect(countWords('  hi  ')).toBe(1))
})

describe('countHashtags', () => {
  it('returns 0 when no hashtags', () => expect(countHashtags('hello world')).toBe(0))
  it('counts hashtags', () => expect(countHashtags('love #food and #travel')).toBe(2))
  it('ignores # without word chars', () => expect(countHashtags('price # is $5')).toBe(0))
})

describe('hasCTA', () => {
  it('returns false for null caption', () => expect(hasCTA(null)).toBe(false))
  it('returns false when no CTA keyword', () => expect(hasCTA('beautiful sunset today')).toBe(false))
  it('detects "dm" (case-insensitive)', () => expect(hasCTA('DM me for details')).toBe(true))
  it('detects "save"', () => expect(hasCTA('Save this for later!')).toBe(true))
  it('detects "link in bio"', () => expect(hasCTA('check the link in bio')).toBe(true))
})

describe('reelDurationLabel', () => {
  it('returns null for null input', () => expect(reelDurationLabel(null)).toBe(null))
  it('returns "0-15s" for 10s', () => expect(reelDurationLabel(10)).toBe('0-15s'))
  it('returns "16-30s" for 25s', () => expect(reelDurationLabel(25)).toBe('16-30s'))
  it('returns "31-60s" for 45s', () => expect(reelDurationLabel(45)).toBe('31-60s'))
  it('returns "61-90s" for 75s', () => expect(reelDurationLabel(75)).toBe('61-90s'))
  it('returns "90s+" for 120s', () => expect(reelDurationLabel(120)).toBe('90s+'))
})

describe('postingTimeLabel', () => {
  const ts = (hour: number) => new Date(2024, 0, 1, hour).toISOString()
  it('morning for 8am', () => expect(postingTimeLabel(ts(8))).toMatch(/morning/))
  it('afternoon for 13:00', () => expect(postingTimeLabel(ts(13))).toMatch(/afternoon/))
  it('evening for 19:00', () => expect(postingTimeLabel(ts(19))).toMatch(/evening/))
  it('night for 23:00', () => expect(postingTimeLabel(ts(23))).toMatch(/night/))
})

// ─── extractPatterns ──────────────────────────────────────────────────────────

function makeMedia(
  id: string,
  overrides: Partial<InstagramMediaWithInsights> = {},
): InstagramMediaWithInsights {
  return {
    id,
    account_id: 'acc',
    user_id: 'user',
    media_id: `ig-${id}`,
    media_type: 'IMAGE',
    is_reel: false,
    caption: null,
    permalink: null,
    thumbnail_url: null,
    media_url: null,
    timestamp: new Date(2024, 0, 1, 9).toISOString(), // 9am
    duration_seconds: null,
    media_product_type: 'FEED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    insights: {
      id: `ins-${id}`,
      media_id_fk: id,
      user_id: 'user',
      reach: 1000,
      impressions: 1500,
      plays: null,
      video_views: null,
      views: null,
      total_interactions: null,
      profile_activity: null,
      replies: null,
      reposts: null,
      reels_skip_rate: null,
      crossposted_views: null,
      facebook_views: null,
      completion_rate: null,
      avg_watch_time_sec: null,
      total_watch_time_ms: null,
      likes: 100,
      comments: 50,
      shares: 30,
      saves: 80,
      profile_visits: 100,
      follows: 20,
      engagement_rate: 0.28,
      synced_at: new Date().toISOString(),
    },
    ...overrides,
  }
}

function makeScore(mediaId: string, totalScore: number): [string, ComputedScore] {
  return [
    mediaId,
    {
      mediaId,
      goal: 'growth',
      totalScore,
      distributionScore: totalScore,
      engagementDepthScore: totalScore,
      conversionScore: totalScore,
      retentionScore: null,
      valueScore: null,
      considerationScore: null,
      weightsSnapshot: {},
    },
  ]
}

describe('extractPatterns', () => {
  it('returns empty result for fewer than 5 posts', () => {
    const media = [makeMedia('a'), makeMedia('b')]
    const scores = new Map([makeScore('a', 80), makeScore('b', 40)])
    const result = extractPatterns(media, scores)
    expect(result.topPostCount).toBe(0)
    expect(result.patterns).toHaveLength(0)
  })

  it('returns empty result when no posts have insights', () => {
    const noIns = Array.from({ length: 10 }, (_, i) =>
      makeMedia(String(i), { insights: null })
    )
    const scores = new Map(noIns.map((m, i) => makeScore(m.id, i * 10)))
    expect(extractPatterns(noIns, scores).topPostCount).toBe(0)
  })

  it('separates top 20% from bottom 20%', () => {
    const media = Array.from({ length: 10 }, (_, i) => makeMedia(String(i)))
    const scores = new Map(media.map((m, i) => makeScore(m.id, (i + 1) * 10)))
    const result = extractPatterns(media, scores)
    // 20% of 10 = 2
    expect(result.topPostCount).toBe(2)
    expect(result.bottomPostCount).toBe(2)
  })

  it('detects high CTA usage in top posts', () => {
    // 10 posts: top 2 have CTA, bottom 2 don't
    const media = Array.from({ length: 10 }, (_, i) =>
      makeMedia(String(i), { caption: i >= 8 ? 'save this!' : 'no cta' })
    )
    // Post 9 → score 100, post 8 → score 90, ..., post 0 → score 10
    const scores = new Map(media.map((m, i) => makeScore(m.id, (i + 1) * 10)))
    const result = extractPatterns(media, scores)
    // Top posts (index 9 and 8) have 'save' CTA
    expect(result.ctaPct.top).toBe(100)
    expect(result.ctaPct.bottom).toBe(0)
  })

  it('includes at least one pattern string', () => {
    const media = Array.from({ length: 10 }, (_, i) =>
      makeMedia(String(i), { media_type: i >= 8 ? 'IMAGE' : 'CAROUSEL_ALBUM' })
    )
    const scores = new Map(media.map((m, i) => makeScore(m.id, (i + 1) * 10)))
    const result = extractPatterns(media, scores)
    expect(result.patterns.length).toBeGreaterThan(0)
    expect(result.summary.length).toBeGreaterThan(0)
  })

  it('topFormatMix sums to 100 for a uniform set', () => {
    const media = Array.from({ length: 10 }, (_, i) => makeMedia(String(i)))
    const scores = new Map(media.map((m, i) => makeScore(m.id, (i + 1) * 10)))
    const mix = extractPatterns(media, scores).topFormatMix
    const total = Object.values(mix).reduce((a, b) => a + b, 0)
    // Rounding may give 99 or 101; allow ±2
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(2)
  })
})
