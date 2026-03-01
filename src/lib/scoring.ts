import type { ScoringInput, ComputedScore, Baselines } from '@/types/scoring'

// ─── Constants ───────────────────────────────────────────────────────────────

const CTA_KEYWORDS = [
  'dm', 'comment', 'link in bio', 'free', 'download',
  'guide', 'template', 'save', 'share', 'tag a friend',
]

const GROWTH_WEIGHTS = {
  distribution: 0.30,  // shares / reach
  saves:        0.25,  // saves  / reach  ─┐ engagementDepth
  comments:     0.15,  // comments / reach ─┘
  conversion:   0.20,  // follows / reach
  retention:    0.10,  // reel watch-time ratio (0.5 for non-Reels)
} as const

const LEADS_WEIGHTS = {
  value:         0.30,  // saves / reach
  distribution:  0.20,  // shares / reach
  consideration: 0.25,  // profile_visits / reach
  follows:       0.15,  // follows / reach  ─┐ conversion
  cta:           0.10,  // CTA keyword present ─┘
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** p95 of an array; returns 0 if empty */
export function computeP95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.95)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/** Compute p95 baselines across all posts that have reach > 0 */
export function computeBaselines(inputs: ScoringInput[]): Baselines {
  const valid = inputs.filter(i => i.reach > 0)
  return {
    sharesReach_p95:        computeP95(valid.map(i => i.shares        / i.reach)),
    savesReach_p95:         computeP95(valid.map(i => i.saves         / i.reach)),
    commentsReach_p95:      computeP95(valid.map(i => i.comments      / i.reach)),
    followsReach_p95:       computeP95(valid.map(i => i.follows       / i.reach)),
    profileVisitsReach_p95: computeP95(valid.map(i => i.profileVisits / i.reach)),
  }
}

/** Normalize a metric against its p95 baseline, capped at 1.0 */
function norm(metric: number, reach: number, p95: number): number {
  if (reach === 0 || p95 === 0) return 0
  return Math.min(metric / reach / p95, 1.0)
}

function hasCTA(caption: string | null): boolean {
  if (!caption) return false
  const lower = caption.toLowerCase()
  return CTA_KEYWORDS.some(kw => lower.includes(kw))
}

const zeroGrowth = (mediaId: string): ComputedScore => ({
  mediaId, goal: 'growth', totalScore: 0,
  distributionScore: null, engagementDepthScore: null,
  conversionScore: null, retentionScore: null,
  valueScore: null, considerationScore: null,
  weightsSnapshot: { ...GROWTH_WEIGHTS },
})

const zeroLeads = (mediaId: string): ComputedScore => ({
  mediaId, goal: 'leads', totalScore: 0,
  distributionScore: null, engagementDepthScore: null,
  conversionScore: null, retentionScore: null,
  valueScore: null, considerationScore: null,
  weightsSnapshot: { ...LEADS_WEIGHTS },
})

// ─── Growth model ─────────────────────────────────────────────────────────────

export function scoreGrowth(input: ScoringInput, baselines: Baselines): ComputedScore {
  if (input.reach === 0) return zeroGrowth(input.mediaId)

  const nShares   = norm(input.shares,   input.reach, baselines.sharesReach_p95)
  const nSaves    = norm(input.saves,    input.reach, baselines.savesReach_p95)
  const nComments = norm(input.comments, input.reach, baselines.commentsReach_p95)
  const nFollows  = norm(input.follows,  input.reach, baselines.followsReach_p95)

  const nRetention =
    input.isReel &&
    input.avgWatchTimeSec != null &&
    input.durationSeconds != null &&
    input.durationSeconds > 0
      ? Math.min(input.avgWatchTimeSec / input.durationSeconds, 1.0)
      : 0.5  // neutral score for non-Reels

  const totalScore = Math.round((
    nShares   * GROWTH_WEIGHTS.distribution +
    nSaves    * GROWTH_WEIGHTS.saves        +
    nComments * GROWTH_WEIGHTS.comments     +
    nFollows  * GROWTH_WEIGHTS.conversion   +
    nRetention * GROWTH_WEIGHTS.retention
  ) * 100)

  // engagementDepth: weighted average of saves + comments sub-scores
  const edWeight = GROWTH_WEIGHTS.saves + GROWTH_WEIGHTS.comments
  const engagementDepthScore = Math.round(
    (nSaves * GROWTH_WEIGHTS.saves + nComments * GROWTH_WEIGHTS.comments) / edWeight * 100
  )

  return {
    mediaId: input.mediaId,
    goal: 'growth',
    totalScore,
    distributionScore:   Math.round(nShares   * 100),
    engagementDepthScore,
    conversionScore:     Math.round(nFollows  * 100),
    retentionScore:      Math.round(nRetention * 100),
    valueScore:          null,
    considerationScore:  null,
    weightsSnapshot:     { ...GROWTH_WEIGHTS },
  }
}

// ─── Leads model ──────────────────────────────────────────────────────────────

export function scoreLeads(input: ScoringInput, baselines: Baselines): ComputedScore {
  if (input.reach === 0) return zeroLeads(input.mediaId)

  const nSaves         = norm(input.saves,         input.reach, baselines.savesReach_p95)
  const nShares        = norm(input.shares,         input.reach, baselines.sharesReach_p95)
  const nProfileVisits = norm(input.profileVisits,  input.reach, baselines.profileVisitsReach_p95)
  const nFollows       = norm(input.follows,        input.reach, baselines.followsReach_p95)
  const ctaScore       = hasCTA(input.caption) ? 1.0 : 0.0

  const totalScore = Math.round((
    nSaves         * LEADS_WEIGHTS.value         +
    nShares        * LEADS_WEIGHTS.distribution  +
    nProfileVisits * LEADS_WEIGHTS.consideration +
    nFollows       * LEADS_WEIGHTS.follows       +
    ctaScore       * LEADS_WEIGHTS.cta
  ) * 100)

  // conversion: weighted average of follows + CTA sub-scores
  const convWeight = LEADS_WEIGHTS.follows + LEADS_WEIGHTS.cta
  const conversionScore = Math.round(
    (nFollows * LEADS_WEIGHTS.follows + ctaScore * LEADS_WEIGHTS.cta) / convWeight * 100
  )

  return {
    mediaId: input.mediaId,
    goal: 'leads',
    totalScore,
    distributionScore:   Math.round(nShares        * 100),
    engagementDepthScore: null,
    conversionScore,
    retentionScore:      null,
    valueScore:          Math.round(nSaves         * 100),
    considerationScore:  Math.round(nProfileVisits * 100),
    weightsSnapshot:     { ...LEADS_WEIGHTS },
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Score all posts for a given goal, returning a Map keyed by DB media UUID */
export function computeScores(
  inputs: ScoringInput[],
  goal: 'growth' | 'leads',
): Map<string, ComputedScore> {
  const baselines = computeBaselines(inputs)
  const scoreFn = goal === 'growth' ? scoreGrowth : scoreLeads
  const result = new Map<string, ComputedScore>()
  for (const input of inputs) {
    result.set(input.mediaId, scoreFn(input, baselines))
  }
  return result
}
