/**
 * PatternSummaryCard — displays account-wide content patterns extracted
 * from the top 20% vs bottom 20% of posts by score.
 */

import type { PatternAnalysis } from '@/lib/patternExtraction'

interface PatternSummaryCardProps {
  analysis: PatternAnalysis
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-400 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-9 text-right">{value}%</span>
    </div>
  )
}

function CompareRow({
  label,
  top,
  bottom,
  suffix = '',
}: {
  label: string
  top: number
  bottom: number
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{label}</span>
      <div className="flex gap-4">
        <span className="font-medium text-green-700">
          {top}{suffix}
          <span className="font-normal text-gray-400 ml-1">top</span>
        </span>
        <span className="font-medium text-gray-400">
          {bottom}{suffix}
          <span className="ml-1">bottom</span>
        </span>
      </div>
    </div>
  )
}

export default function PatternSummaryCard({ analysis }: PatternSummaryCardProps) {
  if (analysis.topPostCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400">{analysis.summary}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* Summary sentence */}
      <div className="bg-brand-50 rounded-lg p-3">
        <p className="text-sm text-brand-800 font-medium leading-snug">{analysis.summary}</p>
      </div>

      {/* Key patterns */}
      {analysis.patterns.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Top patterns
          </h3>
          <ul className="space-y-1.5">
            {analysis.patterns.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-brand-400 mt-0.5 shrink-0">•</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Format mix */}
      {Object.keys(analysis.topFormatMix).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Top posts — format mix
          </h3>
          <div className="space-y-2">
            {Object.entries(analysis.topFormatMix)
              .sort((a, b) => b[1] - a[1])
              .map(([format, pct]) => (
                <BarRow key={format} label={format} value={pct} />
              ))}
          </div>
        </div>
      )}

      {/* Comparison: top vs bottom */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Top vs bottom performers
        </h3>
        <div>
          <CompareRow
            label="Caption words"
            top={analysis.avgCaptionWords.top}
            bottom={analysis.avgCaptionWords.bottom}
          />
          <CompareRow
            label="Hashtags"
            top={analysis.avgHashtagCount.top}
            bottom={analysis.avgHashtagCount.bottom}
          />
          <CompareRow
            label="Has CTA"
            top={analysis.ctaPct.top}
            bottom={analysis.ctaPct.bottom}
            suffix="%"
          />
        </div>
      </div>

      {/* Posting time */}
      {analysis.postingTimeBuckets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Best posting times
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.postingTimeBuckets.slice(0, 3).map(({ label, count }) => (
              <span
                key={label}
                className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1 text-gray-600"
              >
                {label} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
