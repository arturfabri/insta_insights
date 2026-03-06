export interface IGMediaInsightsError {
  message?: string
  type?: string
  code?: number
  error_subcode?: number
}

export interface IGMediaInsightsResponse {
  data?: Array<{
    name: string
    values: Array<{ value: number; end_time?: string }>
  }>
  error?: IGMediaInsightsError
}

interface FetchMediaInsightsWithSafeFallbackInput {
  primaryMetricsCsv: string
  safeMetricsCsv: string
  fetchByMetrics: (metricsCsv: string) => Promise<IGMediaInsightsResponse>
}

export interface FetchMediaInsightsWithSafeFallbackResult {
  responseBody: IGMediaInsightsResponse
  attemptedMetricsCsv: string[]
  usedMetricsCsv: string
  retriedWithSafeMetrics: boolean
}

/**
 * Meta can reject newly introduced metrics per-media even when they are valid
 * for other media types. Detect those contract errors so sync can retry with a
 * conservative baseline instead of dropping the whole insights upsert.
 */
export function isInvalidMetricError(error: IGMediaInsightsError | undefined): boolean {
  if (!error?.message) return false
  const message = error.message.toLowerCase()
  if (!message.includes('metric')) return false

  return (
    message.includes('invalid') ||
    message.includes('unsupported') ||
    message.includes('must be one of') ||
    message.includes('not available') ||
    message.includes('unknown') ||
    (error.code === 100 && message.includes('metric'))
  )
}

export async function fetchMediaInsightsWithSafeFallback(
  input: FetchMediaInsightsWithSafeFallbackInput,
): Promise<FetchMediaInsightsWithSafeFallbackResult> {
  const primaryBody = await input.fetchByMetrics(input.primaryMetricsCsv)

  if (
    !isInvalidMetricError(primaryBody.error) ||
    input.safeMetricsCsv === input.primaryMetricsCsv
  ) {
    return {
      responseBody: primaryBody,
      attemptedMetricsCsv: [input.primaryMetricsCsv],
      usedMetricsCsv: input.primaryMetricsCsv,
      retriedWithSafeMetrics: false,
    }
  }

  const safeBody = await input.fetchByMetrics(input.safeMetricsCsv)
  return {
    responseBody: safeBody,
    attemptedMetricsCsv: [input.primaryMetricsCsv, input.safeMetricsCsv],
    usedMetricsCsv: input.safeMetricsCsv,
    retriedWithSafeMetrics: true,
  }
}
