import { describe, it, expect } from 'vitest'
import {
  computeP95,
  computeBaselines,
  scoreGrowth,
  scoreLeads,
  computeScores,
} from './scoring'
import type { ScoringInput } from '@/types/scoring'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseInput: ScoringInput = {
  mediaId:          'post-1',
  reach:            1000,
  comments:         50,
  shares:           30,
  saves:            80,
  follows:          20,
  profileVisits:    100,
  avgWatchTimeSec:  null,
  durationSeconds:  null,
  isReel:           false,
  caption:          null,
}

// A second post with half the metrics — used to create realistic baselines
const halfInput: ScoringInput = {
  ...baseInput,
  mediaId:       'post-2',
  comments:      25,
  shares:        15,
  saves:         40,
  follows:       10,
  profileVisits: 50,
}

// ─── computeP95 ───────────────────────────────────────────────────────────────

describe('computeP95', () => {
  it('returns 0 for an empty array', () => {
    expect(computeP95([])).toBe(0)
  })

  it('returns the single value for a one-element array', () => {
    expect(computeP95([42])).toBe(42)
  })

  it('returns the correct p95 for a known dataset', () => {
    // 20 values: 19 × 0.01 and 1 × 0.10
    // idx = floor(20 × 0.95) = 19 → sorted[19] = 0.10
    const values = [...Array(19).fill(0.01), 0.10]
    expect(computeP95(values)).toBeCloseTo(0.10)
  })

  it('is not affected by input order', () => {
    const ascending  = [10, 20, 30, 40, 50]
    const descending = [50, 40, 30, 20, 10]
    expect(computeP95(ascending)).toEqual(computeP95(descending))
  })
})

// ─── computeBaselines ────────────────────────────────────────────────────────

describe('computeBaselines', () => {
  it('returns 0 for all baselines when the array is empty', () => {
    const bl = computeBaselines([])
    expect(bl.sharesReach_p95).toBe(0)
    expect(bl.savesReach_p95).toBe(0)
    expect(bl.commentsReach_p95).toBe(0)
    expect(bl.followsReach_p95).toBe(0)
    expect(bl.profileVisitsReach_p95).toBe(0)
  })

  it('excludes posts with reach = 0', () => {
    const zeroReachPost: ScoringInput = { ...baseInput, mediaId: 'z', reach: 0 }
    const bl = computeBaselines([zeroReachPost])
    expect(bl.sharesReach_p95).toBe(0)
  })

  it('computes correct ratios for a single post', () => {
    const bl = computeBaselines([baseInput])
    // With one post, p95 = that value itself
    expect(bl.sharesReach_p95).toBeCloseTo(30 / 1000)          // 0.03
    expect(bl.savesReach_p95).toBeCloseTo(80 / 1000)           // 0.08
    expect(bl.commentsReach_p95).toBeCloseTo(50 / 1000)        // 0.05
    expect(bl.followsReach_p95).toBeCloseTo(20 / 1000)         // 0.02
    expect(bl.profileVisitsReach_p95).toBeCloseTo(100 / 1000)  // 0.10
  })
})

// ─── scoreGrowth ──────────────────────────────────────────────────────────────

describe('scoreGrowth', () => {
  it('returns totalScore = 0 for reach = 0', () => {
    const input: ScoringInput = { ...baseInput, reach: 0 }
    const bl = computeBaselines([baseInput])
    const score = scoreGrowth(input, bl)
    expect(score.totalScore).toBe(0)
    expect(score.goal).toBe('growth')
  })

  it('scores 95 when all metrics equal their p95 baseline (non-reel)', () => {
    // Single-post baselines → all normalised ratios = 1.0, retention = 0.5
    const bl = computeBaselines([baseInput])
    const score = scoreGrowth(baseInput, bl)
    // (1.0×0.30 + 1.0×0.25 + 1.0×0.15 + 1.0×0.20 + 0.5×0.10) × 100 = 95
    expect(score.totalScore).toBe(95)
  })

  it('gives a full retention score (100) for a reel watched completely', () => {
    const reelInput: ScoringInput = {
      ...baseInput,
      isReel: true,
      durationSeconds: 30,
      avgWatchTimeSec: 30, // watched fully
    }
    const bl = computeBaselines([reelInput])
    const score = scoreGrowth(reelInput, bl)
    expect(score.retentionScore).toBe(100)
    // totalScore = (all 1.0 ratios) × 100
    expect(score.totalScore).toBe(100)
  })

  it('caps normalised values at 1.0 (no super-scores)', () => {
    // halfInput metrics are well below baseInput p95
    const bl = computeBaselines([baseInput]) // high baseline
    const score = scoreGrowth(halfInput, bl)
    expect(score.totalScore).toBeLessThanOrEqual(100)
    expect(score.distributionScore).toBeLessThanOrEqual(100)
  })

  it('includes distributionScore, engagementDepthScore, conversionScore, retentionScore', () => {
    const bl = computeBaselines([baseInput])
    const score = scoreGrowth(baseInput, bl)
    expect(score.distributionScore).not.toBeNull()
    expect(score.engagementDepthScore).not.toBeNull()
    expect(score.conversionScore).not.toBeNull()
    expect(score.retentionScore).not.toBeNull()
    // Leads-only sub-scores should be null
    expect(score.valueScore).toBeNull()
    expect(score.considerationScore).toBeNull()
  })

  it('sets goal to "growth"', () => {
    const bl = computeBaselines([baseInput])
    expect(scoreGrowth(baseInput, bl).goal).toBe('growth')
  })
})

// ─── scoreLeads ───────────────────────────────────────────────────────────────

describe('scoreLeads', () => {
  it('returns totalScore = 0 for reach = 0', () => {
    const input: ScoringInput = { ...baseInput, reach: 0 }
    const bl = computeBaselines([baseInput])
    const score = scoreLeads(input, bl)
    expect(score.totalScore).toBe(0)
    expect(score.goal).toBe('leads')
  })

  it('scores 90 when all metrics equal p95 baseline and no CTA', () => {
    // No CTA → ctaScore = 0 → totalScore = (1.0×0.30+1.0×0.20+1.0×0.25+1.0×0.15+0.0×0.10)×100 = 90
    const bl = computeBaselines([baseInput])
    const score = scoreLeads(baseInput, bl) // caption = null → no CTA
    expect(score.totalScore).toBe(90)
  })

  it('scores 100 when all metrics equal p95 and CTA is present', () => {
    const ctaInput: ScoringInput = { ...baseInput, caption: 'Save this for later, dm me for the link in bio' }
    const bl = computeBaselines([ctaInput])
    const score = scoreLeads(ctaInput, bl)
    expect(score.totalScore).toBe(100)
  })

  it('detects CTA keywords case-insensitively', () => {
    const ctaInput: ScoringInput = { ...baseInput, caption: 'DM me for details' }
    const bl = computeBaselines([ctaInput])
    const score = scoreLeads(ctaInput, bl)
    expect(score.totalScore).toBe(100)
  })

  it('does not detect CTA when caption is null', () => {
    const bl = computeBaselines([baseInput])
    const score = scoreLeads({ ...baseInput, caption: null }, bl)
    // ctaScore = 0 → totalScore = 90
    expect(score.totalScore).toBe(90)
  })

  it('includes valueScore, considerationScore, distributionScore, conversionScore', () => {
    const bl = computeBaselines([baseInput])
    const score = scoreLeads(baseInput, bl)
    expect(score.valueScore).not.toBeNull()
    expect(score.considerationScore).not.toBeNull()
    expect(score.distributionScore).not.toBeNull()
    expect(score.conversionScore).not.toBeNull()
    // Growth-only sub-scores should be null
    expect(score.engagementDepthScore).toBeNull()
    expect(score.retentionScore).toBeNull()
  })

  it('sets goal to "leads"', () => {
    const bl = computeBaselines([baseInput])
    expect(scoreLeads(baseInput, bl).goal).toBe('leads')
  })
})

// ─── computeScores ────────────────────────────────────────────────────────────

describe('computeScores', () => {
  it('returns an empty Map for an empty inputs array', () => {
    const result = computeScores([], 'growth')
    expect(result.size).toBe(0)
  })

  it('keys the Map by mediaId', () => {
    const result = computeScores([baseInput, halfInput], 'growth')
    expect(result.has('post-1')).toBe(true)
    expect(result.has('post-2')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('uses the growth model when goal = "growth"', () => {
    const result = computeScores([baseInput], 'growth')
    expect(result.get('post-1')?.goal).toBe('growth')
  })

  it('uses the leads model when goal = "leads"', () => {
    const result = computeScores([baseInput], 'leads')
    expect(result.get('post-1')?.goal).toBe('leads')
  })

  it('all totalScores are in [0, 100]', () => {
    const inputs = [baseInput, halfInput, { ...baseInput, mediaId: 'post-3', reach: 0 }]
    for (const goal of ['growth', 'leads'] as const) {
      const result = computeScores(inputs, goal)
      for (const score of result.values()) {
        expect(score.totalScore).toBeGreaterThanOrEqual(0)
        expect(score.totalScore).toBeLessThanOrEqual(100)
      }
    }
  })
})
