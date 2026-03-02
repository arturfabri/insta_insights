export type MetricFactScope =
  | 'media'
  | 'account'
  | 'business_discovery_account'
  | 'business_discovery_media'

export interface IGInsightMetricValue {
  value: number | Record<string, unknown> | null
  end_time?: string
}

export interface IGInsightMetric {
  name: string
  period?: string
  values: IGInsightMetricValue[]
}

export interface MetricFactRow {
  user_id: string
  account_id: string
  scope: MetricFactScope
  entity_id: string
  metric_name: string
  metric_value_numeric: number | null
  metric_value_jsonb: Record<string, unknown> | null
  period: string
  metric_type: string
  timeframe: string
  breakdown_type: string
  breakdown_value: string
  metric_date: string
  fetched_at: string
}

interface BaseMetricFactsInput {
  userId: string
  accountId: string
  scope: MetricFactScope
  entityId: string
  metrics: IGInsightMetric[]
  fetchDate: string
  fetchedAtIso: string
  metricType?: string | null
  timeframe?: string | null
  breakdownType?: string | null
  breakdownValue?: string | null
}

interface AccountMetricFactsInput extends BaseMetricFactsInput {
  scope: 'account' | 'business_discovery_account'
  metricSeriesType: 'time_series' | 'total_value'
}

interface SnapshotMetricFactsInput extends BaseMetricFactsInput {
  scope: 'media' | 'business_discovery_media'
}

function toDateOnly(dateLike: string): string | null {
  const parsed = new Date(dateLike)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function toMetricDateFromSeries(endTime: string | undefined, fetchDate: string): string {
  if (!endTime) return fetchDate
  return toDateOnly(endTime) ?? fetchDate
}

function toFactValue(value: number | Record<string, unknown> | null): {
  numeric: number | null
  jsonb: Record<string, unknown> | null
} {
  if (typeof value === 'number') {
    return { numeric: value, jsonb: null }
  }
  if (value && typeof value === 'object') {
    return { numeric: null, jsonb: value }
  }
  return { numeric: null, jsonb: null }
}

function baseRow(input: BaseMetricFactsInput, metricName: string): Omit<MetricFactRow, 'metric_date' | 'metric_value_numeric' | 'metric_value_jsonb'> {
  return {
    user_id: input.userId,
    account_id: input.accountId,
    scope: input.scope,
    entity_id: input.entityId,
    metric_name: metricName,
    period: '',
    metric_type: input.metricType ?? '',
    timeframe: input.timeframe ?? '',
    breakdown_type: input.breakdownType ?? '',
    breakdown_value: input.breakdownValue ?? '',
    fetched_at: input.fetchedAtIso,
  }
}

export function normalizeFetchDate(fetchAtIso: string): string {
  const dateOnly = toDateOnly(fetchAtIso)
  if (!dateOnly) {
    throw new Error(`Invalid fetch timestamp: ${fetchAtIso}`)
  }
  return dateOnly
}

export function mapSnapshotMetricsToFacts(input: SnapshotMetricFactsInput): MetricFactRow[] {
  const rows: MetricFactRow[] = []

  for (const metric of input.metrics) {
    const firstValue = metric.values?.[0]?.value ?? null
    const normalized = toFactValue(firstValue)
    rows.push({
      ...baseRow(input, metric.name),
      period: metric.period ?? '',
      metric_date: input.fetchDate,
      metric_value_numeric: normalized.numeric,
      metric_value_jsonb: normalized.jsonb,
    })
  }

  return rows
}

export function mapAccountMetricsToFacts(input: AccountMetricFactsInput): MetricFactRow[] {
  const rows: MetricFactRow[] = []

  for (const metric of input.metrics) {
    const values = metric.values ?? []
    if (values.length === 0) continue

    for (const valueEntry of values) {
      const normalized = toFactValue(valueEntry.value ?? null)
      rows.push({
        ...baseRow(input, metric.name),
        period: metric.period ?? '',
        metric_date:
          input.metricSeriesType === 'time_series'
            ? toMetricDateFromSeries(valueEntry.end_time, input.fetchDate)
            : input.fetchDate,
        metric_value_numeric: normalized.numeric,
        metric_value_jsonb: normalized.jsonb,
      })
    }
  }

  return rows
}
