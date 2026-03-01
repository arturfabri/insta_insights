/**
 * ScoreBadge — circular ring chart showing a 0–100 score.
 *
 * Colour bands:
 *   0–39  → red   (#dc2626)
 *   40–69 → amber (#d97706)
 *   70–100 → green (#16a34a)
 */

interface ScoreBadgeProps {
  score: number
  /** Outer diameter in px (default: 48) */
  size?: number
  /** Optional accessible label (default: "Score: {score}") */
  label?: string
}

const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getColor(score: number): string {
  if (score >= 70) return '#16a34a' // green-600
  if (score >= 40) return '#d97706' // amber-600
  return '#dc2626'                  // red-600
}

export default function ScoreBadge({ score, size = 48, label }: ScoreBadgeProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const dashOffset = CIRCUMFERENCE * (1 - clampedScore / 100)
  const color = getColor(clampedScore)
  const ariaLabel = label ?? `Score: ${clampedScore}`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Ring — rotated so arc starts at 12 o'clock */}
      <svg
        viewBox="0 0 44 44"
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={22}
          cy={22}
          r={RADIUS}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={4}
        />
        {/* Foreground arc */}
        <circle
          cx={22}
          cy={22}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>

      {/* Numeric label */}
      <span
        className="absolute inset-0 flex items-center justify-center font-bold leading-none select-none"
        style={{
          color,
          fontSize: size < 40 ? '9px' : size < 56 ? '11px' : '13px',
        }}
        aria-hidden="true"
      >
        {clampedScore}
      </span>
    </div>
  )
}
