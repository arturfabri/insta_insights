/**
 * MetricsGrid — 3-column grid of key metrics, each showing:
 *   - the raw value (formatted)
 *   - a delta badge vs the account median (green when above, red when below)
 */

export interface MetricItem {
  label: string
  value: number | null
  /** Account-wide median for this metric. Shown as a delta if provided. */
  median?: number | null
  /** How to format the raw value (default: 'number') */
  format?: 'number' | 'percent' | 'seconds'
  icon?: string
}

interface MetricsGridProps {
  metrics: MetricItem[]
}

function formatValue(value: number, format: MetricItem['format']): string {
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'seconds') {
    if (value >= 60) return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`
    return `${Math.round(value)}s`
  }
  // number
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

function DeltaBadge({ value, median }: { value: number; median: number }) {
  if (median === 0) return null
  const pct = ((value - median) / median) * 100
  const isPositive = pct >= 0
  const label = `${isPositive ? '+' : ''}${pct.toFixed(0)}% vs median`
  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
        isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {label}
    </span>
  )
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {metrics.map(({ label, value, median, format = 'number', icon }) => (
        <div
          key={label}
          className="bg-white rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center gap-1.5 mb-1">
            {icon && <span className="text-base">{icon}</span>}
            <p className="text-xs text-gray-500 font-medium">{label}</p>
          </div>
          {value != null ? (
            <>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatValue(value, format)}
              </p>
              {median != null && (
                <DeltaBadge value={value} median={median} />
              )}
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-300">—</p>
          )}
        </div>
      ))}
    </div>
  )
}
