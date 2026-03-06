import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface InsightKpiCardProps {
  label: string
  value: number | null
  previousValue: number | null
  valueLabel: string
  unavailable?: boolean
  sparklineData?: Array<{ label: string; value: number | null }>
}

function formatDelta(value: number | null, previousValue: number | null) {
  if (value == null || previousValue == null) return 'No previous period'
  const diff = value - previousValue

  if (previousValue !== 0) {
    const percent = (diff / previousValue) * 100
    const rounded = `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}%`
    return `${rounded} vs previous`
  }

  if (diff === 0) return 'No change vs previous'
  return `${diff >= 0 ? '+' : ''}${diff.toLocaleString()} vs previous`
}

function trendTone(value: number | null, previousValue: number | null) {
  if (value == null || previousValue == null) return 'text-gray-500'
  if (value > previousValue) return 'text-green-700'
  if (value < previousValue) return 'text-red-600'
  return 'text-gray-500'
}

/**
 * Compact KPI card used on the account insights page.
 * It compares the selected period against the immediately previous period and
 * optionally renders a sparkline for snapshot-style metrics.
 */
export default function InsightKpiCard({
  label,
  value,
  previousValue,
  valueLabel,
  unavailable = false,
  sparklineData,
}: InsightKpiCardProps) {
  return (
    <section
      aria-label={`${label} KPI`}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {unavailable ? (
        <p className="mt-3 text-sm text-gray-400">Unavailable</p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-bold text-gray-900">{valueLabel}</p>
          <p className={`mt-1 text-sm font-medium ${trendTone(value, previousValue)}`}>
            {formatDelta(value, previousValue)}
          </p>
          {sparklineData && sparklineData.some((item) => item.value != null) && (
            <div className="mt-4 h-16" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Tooltip
                    formatter={(nextValue) => [
                      typeof nextValue === 'number' ? nextValue.toLocaleString() : nextValue,
                      label,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  )
}
