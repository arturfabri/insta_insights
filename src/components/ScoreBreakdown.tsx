/**
 * ScoreBreakdown — per-sub-score horizontal bars + rule-based insight text.
 *
 * Sub-score rules (threshold-based):
 *   Growth model:  distribution, engagementDepth, conversion, retention
 *   Leads  model:  value, distribution, consideration, conversion
 *
 * "What worked"    → sub-scores ≥ 65 (positive signals)
 * "What to improve" → sub-scores < 40 (actionable suggestions)
 */

import type { ComputedScore } from '@/types/scoring'

interface ScoreBreakdownProps {
  score: ComputedScore
  isReel?: boolean
}

// ─── Sub-score bar ────────────────────────────────────────────────────────────

function SubScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  const color =
    value >= 70 ? '#16a34a' :  // green-600
    value >= 40 ? '#d97706' :  // amber-600
                  '#dc2626'   // red-600

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── Rule-based insights ──────────────────────────────────────────────────────

interface Insight {
  text: string
  type: 'positive' | 'improve'
}

function growthInsights(score: ComputedScore, isReel: boolean): Insight[] {
  const insights: Insight[] = []
  const { distributionScore, engagementDepthScore, conversionScore, retentionScore } = score

  if (distributionScore != null) {
    if (distributionScore >= 65)
      insights.push({ type: 'positive', text: 'Strong sharing — this content drove organic distribution.' })
    else if (distributionScore < 40)
      insights.push({ type: 'improve', text: 'Low shares — add a direct "share this with someone who needs it" CTA.' })
  }

  if (engagementDepthScore != null) {
    if (engagementDepthScore >= 65)
      insights.push({ type: 'positive', text: 'High saves and comments — this resonated deeply with your audience.' })
    else if (engagementDepthScore < 40)
      insights.push({ type: 'improve', text: 'Low saves/comments — ask a question or give a reason to save at the end.' })
  }

  if (conversionScore != null) {
    if (conversionScore >= 65)
      insights.push({ type: 'positive', text: 'Great follow conversion — this post brought in new followers.' })
    else if (conversionScore < 40)
      insights.push({ type: 'improve', text: 'Weak follow conversion — make sure your profile bio is clear and compelling.' })
  }

  if (isReel && retentionScore != null) {
    if (retentionScore >= 70)
      insights.push({ type: 'positive', text: 'Excellent Reel retention — viewers are watching through to the end.' })
    else if (retentionScore < 40)
      insights.push({ type: 'improve', text: 'Reel watch time is low — try a stronger hook in the first 2–3 seconds.' })
  }

  return insights
}

function leadsInsights(score: ComputedScore): Insight[] {
  const insights: Insight[] = []
  const { valueScore, distributionScore, considerationScore, conversionScore } = score

  if (valueScore != null) {
    if (valueScore >= 65)
      insights.push({ type: 'positive', text: 'High save rate — this is being bookmarked as a valuable reference.' })
    else if (valueScore < 40)
      insights.push({ type: 'improve', text: 'Few saves — make the content more "save-worthy" with tips, frameworks or checklists.' })
  }

  if (considerationScore != null) {
    if (considerationScore >= 65)
      insights.push({ type: 'positive', text: 'High profile visits — this post is driving audience discovery.' })
    else if (considerationScore < 40)
      insights.push({ type: 'improve', text: 'Low profile visits — mention your expertise or niche more clearly in the caption.' })
  }

  if (distributionScore != null) {
    if (distributionScore >= 65)
      insights.push({ type: 'positive', text: 'Good shares — your audience is spreading this content.' })
    else if (distributionScore < 40)
      insights.push({ type: 'improve', text: 'Low shares — add "share this if you know someone who needs to hear it".' })
  }

  if (conversionScore != null) {
    if (conversionScore >= 65)
      insights.push({ type: 'positive', text: 'Strong lead signals — followers and CTA engagement are high.' })
    else if (conversionScore < 40)
      insights.push({ type: 'improve', text: 'Weak CTA conversion — include a clear next step like "DM me", "link in bio" or "save for later".' })
  }

  return insights
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreBreakdown({ score, isReel = false }: ScoreBreakdownProps) {
  const isGrowth = score.goal === 'growth'

  const subScores = isGrowth
    ? [
        { label: 'Distribution (shares)', value: score.distributionScore },
        { label: 'Engagement depth (saves + comments)', value: score.engagementDepthScore },
        { label: 'Conversion (follows)', value: score.conversionScore },
        { label: 'Retention (watch time)', value: score.retentionScore },
      ]
    : [
        { label: 'Value (saves)', value: score.valueScore },
        { label: 'Consideration (profile visits)', value: score.considerationScore },
        { label: 'Distribution (shares)', value: score.distributionScore },
        { label: 'Conversion (follows + CTA)', value: score.conversionScore },
      ]

  const insights = isGrowth
    ? growthInsights(score, isReel)
    : leadsInsights(score)

  const positives = insights.filter(i => i.type === 'positive')
  const improvements = insights.filter(i => i.type === 'improve')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-900">
          {isGrowth ? 'Growth' : 'Leads & Sales'} Score
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-2xl font-bold ${
              score.totalScore >= 70 ? 'text-green-600' :
              score.totalScore >= 40 ? 'text-amber-600' :
              'text-red-600'
            }`}
          >
            {score.totalScore}
          </span>
          <span className="text-sm text-gray-400">/ 100</span>
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-3 mb-6">
        {subScores.map(({ label, value }) => (
          <SubScoreBar key={label} label={label} value={value} />
        ))}
      </div>

      {/* Insights */}
      {(positives.length > 0 || improvements.length > 0) && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          {positives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                <span>✓</span> What worked
              </p>
              <ul className="space-y-1">
                {positives.map((ins, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                    {ins.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                <span>↑</span> What to improve
              </p>
              <ul className="space-y-1">
                {improvements.map((ins, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                    {ins.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
