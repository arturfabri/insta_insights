import { describe, expect, it, vi } from 'vitest'
import {
  fetchMediaInsightsWithSafeFallback,
  isInvalidMetricError,
  type IGMediaInsightsResponse,
} from './media-insights-fetch'

describe('isInvalidMetricError', () => {
  it('returns true for metric contract errors', () => {
    expect(
      isInvalidMetricError({
        code: 100,
        message: '(#100) Invalid metric name: reels_skip_rate',
      }),
    ).toBe(true)
  })

  it('returns false for non-metric provider errors', () => {
    expect(
      isInvalidMetricError({
        code: 190,
        message: 'Invalid OAuth access token.',
      }),
    ).toBe(false)
  })
})

describe('fetchMediaInsightsWithSafeFallback', () => {
  const primary = 'reach,views,reels_skip_rate'
  const safe = 'reach,views,saved,shares,comments'

  it('returns primary response when no error exists', async () => {
    const fetchByMetrics = vi.fn<
      (metricsCsv: string) => Promise<IGMediaInsightsResponse>
    >().mockResolvedValue({ data: [{ name: 'reach', values: [{ value: 10 }] }] })

    const result = await fetchMediaInsightsWithSafeFallback({
      primaryMetricsCsv: primary,
      safeMetricsCsv: safe,
      fetchByMetrics,
    })

    expect(fetchByMetrics).toHaveBeenCalledTimes(1)
    expect(fetchByMetrics).toHaveBeenCalledWith(primary)
    expect(result.retriedWithSafeMetrics).toBe(false)
    expect(result.usedMetricsCsv).toBe(primary)
    expect(result.attemptedMetricsCsv).toEqual([primary])
  })

  it('retries with safe metrics when primary response has invalid metric error', async () => {
    const fetchByMetrics = vi
      .fn<(metricsCsv: string) => Promise<IGMediaInsightsResponse>>()
      .mockResolvedValueOnce({
        error: {
          code: 100,
          message: '(#100) Invalid metric name: reels_skip_rate',
        },
      })
      .mockResolvedValueOnce({
        data: [{ name: 'reach', values: [{ value: 25 }] }],
      })

    const result = await fetchMediaInsightsWithSafeFallback({
      primaryMetricsCsv: primary,
      safeMetricsCsv: safe,
      fetchByMetrics,
    })

    expect(fetchByMetrics).toHaveBeenCalledTimes(2)
    expect(fetchByMetrics).toHaveBeenNthCalledWith(1, primary)
    expect(fetchByMetrics).toHaveBeenNthCalledWith(2, safe)
    expect(result.retriedWithSafeMetrics).toBe(true)
    expect(result.usedMetricsCsv).toBe(safe)
    expect(result.attemptedMetricsCsv).toEqual([primary, safe])
    expect(result.responseBody.error).toBeUndefined()
  })

  it('does not retry for non-metric errors', async () => {
    const fetchByMetrics = vi.fn<
      (metricsCsv: string) => Promise<IGMediaInsightsResponse>
    >().mockResolvedValue({
      error: {
        code: 190,
        message: 'Invalid OAuth access token.',
      },
    })

    const result = await fetchMediaInsightsWithSafeFallback({
      primaryMetricsCsv: primary,
      safeMetricsCsv: safe,
      fetchByMetrics,
    })

    expect(fetchByMetrics).toHaveBeenCalledTimes(1)
    expect(result.retriedWithSafeMetrics).toBe(false)
    expect(result.usedMetricsCsv).toBe(primary)
    expect(result.responseBody.error?.code).toBe(190)
  })
})
