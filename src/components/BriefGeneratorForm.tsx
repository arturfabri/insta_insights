/**
 * BriefGeneratorForm — count selector + generate button for AI content briefs.
 * Calls the generate-brief Edge Function and surfaces errors + rate-limit info.
 */

import { useState } from 'react'
import { supabaseClient } from '@/lib/supabase'
import type { ContentBrief, Goal } from '@/types/database'

const VALID_COUNTS = [5, 10, 20] as const
type BriefCount = (typeof VALID_COUNTS)[number]

interface BriefGeneratorFormProps {
  patternSummary: string
  topPostSummaries: string[]
  accountId?: string
  goal: Goal
  onBriefsGenerated: (briefs: ContentBrief[]) => void
}

export default function BriefGeneratorForm({
  patternSummary,
  topPostSummaries,
  accountId,
  goal,
  onBriefsGenerated,
}: BriefGeneratorFormProps) {
  const [count, setCount] = useState<BriefCount>(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabaseClient.functions.invoke<{
        success: boolean
        briefs?: ContentBrief[]
        error?: string
      }>('generate-brief', {
        body: {
          goal,
          count,
          patternSummary,
          topPostSummaries,
          accountId,
        },
      })

      if (fnError) {
        // Try to surface the real error from the response body
        let detail = fnError.message
        try {
          const body = await (fnError.context as Response).text()
          const parsed = JSON.parse(body) as { error?: string }
          if (parsed.error) detail = parsed.error
        } catch {
          // ignore parse errors, fall back to generic message
        }
        setError(detail)
        return
      }

      if (!data?.success || !data.briefs) {
        setError(data?.error ?? 'Generation failed. Please try again.')
        return
      }

      onBriefsGenerated(data.briefs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Generate Content Briefs</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            AI-powered briefs based on your top-performing posts
          </p>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">Up to 10/day</span>
      </div>

      {/* Count selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 shrink-0">Number of briefs:</span>
        <div className="flex gap-1.5">
          {VALID_COUNTS.map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              disabled={loading}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                count === n
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating {count} briefs…
          </>
        ) : (
          <>
            <span>✨</span>
            Generate {count} briefs
          </>
        )}
      </button>
    </div>
  )
}
