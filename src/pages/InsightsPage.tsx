import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '@/components/EmptyState'
import InsightKpiCard from '@/components/InsightKpiCard'
import InsightsChartCard from '@/components/InsightsChartCard'
import { useAccountInsights } from '@/hooks/useAccountInsights'
import {
  buildAccountInsightsView,
  type AccountInsightMetricKey,
  type InsightsGranularity,
} from '@/lib/accountInsights'

const GRANULARITY_OPTIONS: Array<{ value: InsightsGranularity; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const PERFORMANCE_SERIES = [
  { key: 'reach', label: 'Reach', color: '#2563eb' },
  { key: 'views', label: 'Views', color: '#14b8a6' },
  { key: 'total_interactions', label: 'Total interactions', color: '#f97316' },
] as const satisfies Array<{ key: AccountInsightMetricKey; label: string; color: string }>

const SUMMARY_METRICS: Array<{ key: AccountInsightMetricKey; label: string }> = [
  { key: 'reach', label: 'Reach' },
  { key: 'views', label: 'Views' },
  { key: 'total_interactions', label: 'Total interactions' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'replies', label: 'Replies' },
  { key: 'shares', label: 'Shares' },
  { key: 'saves', label: 'Saves' },
  { key: 'reposts', label: 'Reposts' },
  { key: 'profile_links_taps', label: 'Profile link taps' },
  { key: 'accounts_engaged', label: 'Accounts engaged' },
  { key: 'follows', label: 'Follows' },
  { key: 'unfollows', label: 'Unfollows' },
  { key: 'net_follower_growth', label: 'Net follower growth' },
]

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatMetricValue(key: AccountInsightMetricKey, value: number | null) {
  if (value == null) return 'Unavailable'
  if (key === 'net_follower_growth') {
    return `${value >= 0 ? '+' : ''}${formatCompactNumber(value)}`
  }
  return formatCompactNumber(value)
}

function formatTooltipValue(value: number | string | undefined, label: string | undefined): [string, string] {
  const nextLabel = label ?? 'Metric'
  if (typeof value !== 'number') return [String(value ?? '—'), nextLabel]
  if (nextLabel === 'Net growth') {
    return [`${value >= 0 ? '+' : ''}${value.toLocaleString()}`, nextLabel]
  }
  return [value.toLocaleString(), nextLabel]
}

function sectionAvailability(metricAvailability: ReturnType<typeof buildAccountInsightsView>['summary']['metricAvailability']) {
  return {
    performance:
      metricAvailability.reach ||
      metricAvailability.views ||
      metricAvailability.total_interactions,
    interactionMix:
      metricAvailability.likes ||
      metricAvailability.comments ||
      metricAvailability.replies ||
      metricAvailability.shares ||
      metricAvailability.saves ||
      metricAvailability.reposts,
    audienceGrowth:
      metricAvailability.follows ||
      metricAvailability.unfollows ||
      metricAvailability.net_follower_growth,
    profileAction: metricAvailability.profile_links_taps,
    accountsEngaged: metricAvailability.accounts_engaged,
  }
}

function toggleSeries(
  previous: Set<AccountInsightMetricKey>,
  metric: AccountInsightMetricKey,
) {
  const next = new Set(previous)
  if (next.has(metric)) next.delete(metric)
  else next.add(metric)
  return next
}

export default function InsightsPage() {
  const { account, insights, loading, error, refetch } = useAccountInsights()
  const [granularity, setGranularity] = useState<InsightsGranularity>('day')
  const [hiddenPerformanceSeries, setHiddenPerformanceSeries] = useState<Set<AccountInsightMetricKey>>(new Set())

  const viewModel = useMemo(
    () => buildAccountInsightsView(insights, granularity),
    [insights, granularity],
  )

  const availability = useMemo(
    () => sectionAvailability(viewModel.summary.metricAvailability),
    [viewModel.summary.metricAvailability],
  )

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-52 rounded bg-gray-200" />
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl bg-gray-200" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-96 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-900">Account Insights</h1>
        <p className="mt-2 text-sm text-red-700">Failed to load account insights: {error}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!account) {
    return (
      <EmptyState
        icon="📈"
        title="Connect an account first"
        description="Connect your Instagram business account through Meta Business Login before opening account-level insights."
        action={{ label: 'Go to Connect', href: '/connect' }}
      />
    )
  }

  if (insights.length === 0) {
    return (
      <EmptyState
        icon="🗓️"
        title="No account insights yet"
        description="Run a sync from Connections to populate daily account insights before using this page."
        action={{ label: 'Go to Connect', href: '/connect' }}
      />
    )
  }

  const latestUpdatedAtLabel = viewModel.summary.latestUpdatedAt
    ? `${formatDistanceToNow(new Date(viewModel.summary.latestUpdatedAt), { addSuffix: true })}`
    : 'Unknown'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">@{account.username}</p>
          <h1 className="text-2xl font-bold text-gray-900">Account Insights</h1>
          <p className="mt-1 text-sm text-gray-500">
            Daily account metrics grouped by {granularity}. Last updated {latestUpdatedAtLabel}.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm" role="group" aria-label="Insights granularity">
          {GRANULARITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={granularity === option.value}
              onClick={() => setGranularity(option.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                granularity === option.value
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InsightKpiCard
          label="Reach"
          value={viewModel.summary.currentTotals.reach}
          previousValue={viewModel.summary.previousTotals.reach}
          valueLabel={formatMetricValue('reach', viewModel.summary.currentTotals.reach)}
          unavailable={!viewModel.summary.metricAvailability.reach}
        />
        <InsightKpiCard
          label="Views"
          value={viewModel.summary.currentTotals.views}
          previousValue={viewModel.summary.previousTotals.views}
          valueLabel={formatMetricValue('views', viewModel.summary.currentTotals.views)}
          unavailable={!viewModel.summary.metricAvailability.views}
        />
        <InsightKpiCard
          label="Total interactions"
          value={viewModel.summary.currentTotals.total_interactions}
          previousValue={viewModel.summary.previousTotals.total_interactions}
          valueLabel={formatMetricValue('total_interactions', viewModel.summary.currentTotals.total_interactions)}
          unavailable={!viewModel.summary.metricAvailability.total_interactions}
        />
        <InsightKpiCard
          label="Accounts engaged"
          value={viewModel.summary.currentTotals.accounts_engaged}
          previousValue={viewModel.summary.previousTotals.accounts_engaged}
          valueLabel={formatMetricValue('accounts_engaged', viewModel.summary.currentTotals.accounts_engaged)}
          unavailable={!availability.accountsEngaged}
          sparklineData={viewModel.summary.accountsEngagedSparkline}
        />
        <InsightKpiCard
          label="Net follower growth"
          value={viewModel.summary.currentTotals.net_follower_growth}
          previousValue={viewModel.summary.previousTotals.net_follower_growth}
          valueLabel={formatMetricValue('net_follower_growth', viewModel.summary.currentTotals.net_follower_growth)}
          unavailable={!viewModel.summary.metricAvailability.net_follower_growth}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightsChartCard
          title="Performance Trend"
          description="Reach, views, and total interactions across the selected buckets."
          unavailable={!availability.performance}
          unavailableMessage="Performance metrics are not available for this account yet."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {PERFORMANCE_SERIES.map((series) => (
              <button
                key={series.key}
                type="button"
                aria-pressed={!hiddenPerformanceSeries.has(series.key)}
                onClick={() => setHiddenPerformanceSeries((current) => toggleSeries(current, series.key))}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  hiddenPerformanceSeries.has(series.key)
                    ? 'border-gray-200 bg-white text-gray-500'
                    : 'border-transparent text-white'
                }`}
                style={{
                  backgroundColor: hiddenPerformanceSeries.has(series.key) ? '#ffffff' : series.color,
                }}
              >
                {series.label}
              </button>
            ))}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={viewModel.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                {!hiddenPerformanceSeries.has('reach') && (
                  <Area type="monotone" dataKey="reach" name="Reach" fill="#93c5fd" stroke="#2563eb" fillOpacity={0.28} isAnimationActive={false} />
                )}
                {!hiddenPerformanceSeries.has('views') && (
                  <Area type="monotone" dataKey="views" name="Views" fill="#99f6e4" stroke="#14b8a6" fillOpacity={0.24} isAnimationActive={false} />
                )}
                {!hiddenPerformanceSeries.has('total_interactions') && (
                  <Line type="monotone" dataKey="total_interactions" name="Total interactions" stroke="#f97316" strokeWidth={3} dot={false} isAnimationActive={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </InsightsChartCard>

        <InsightsChartCard
          title="Interaction Mix"
          description="Stacked interaction totals per bucket."
          unavailable={!availability.interactionMix}
          unavailableMessage="Interaction mix metrics are not available for this account yet."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={viewModel.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <Bar dataKey="likes" name="Likes" stackId="interactions" fill="#2563eb" isAnimationActive={false} />
                <Bar dataKey="comments" name="Comments" stackId="interactions" fill="#14b8a6" isAnimationActive={false} />
                <Bar dataKey="replies" name="Replies" stackId="interactions" fill="#0ea5e9" isAnimationActive={false} />
                <Bar dataKey="shares" name="Shares" stackId="interactions" fill="#f97316" isAnimationActive={false} />
                <Bar dataKey="saves" name="Saves" stackId="interactions" fill="#8b5cf6" isAnimationActive={false} />
                <Bar dataKey="reposts" name="Reposts" stackId="interactions" fill="#ef4444" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </InsightsChartCard>

        <InsightsChartCard
          title="Audience Growth"
          description="Follows and unfollows as bars, with net growth on the same timeline."
          unavailable={!availability.audienceGrowth}
          unavailableMessage="Audience growth metrics are not available for this account yet."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={viewModel.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                <Bar dataKey="follows" name="Follows" fill="#16a34a" isAnimationActive={false} />
                <Bar dataKey="unfollows" name="Unfollows" fill="#dc2626" isAnimationActive={false} />
                <Line type="monotone" dataKey="net_follower_growth" name="Net growth" stroke="#111827" strokeWidth={3} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </InsightsChartCard>

        <InsightsChartCard
          title="Profile Action"
          description="Profile link taps per bucket."
          unavailable={!availability.profileAction}
          unavailableMessage="Profile link taps are not available for this account yet."
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={viewModel.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={formatTooltipValue} />
                <Bar dataKey="profile_links_taps" name="Profile link taps" fill="#0f766e" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </InsightsChartCard>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Selected Period Summary</h2>
          <p className="mt-1 text-sm text-gray-500">
            Totals for the visible {granularity} buckets. Accounts engaged keeps the latest visible daily value; all other metrics are rolled up from daily totals.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_METRICS.map((metric) => (
            <div key={metric.key} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{metric.label}</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {viewModel.summary.metricAvailability[metric.key]
                  ? formatMetricValue(metric.key, viewModel.summary.currentTotals[metric.key])
                  : 'Unavailable'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
