/**
 * FilterBar — sort dropdown + content-type pills for the Dashboard grid.
 *
 * State types and the reducer live in @/lib/filterState so this file
 * stays component-only (required for React Fast Refresh).
 */

import type { FilterState, FilterAction, SortBy, MediaTypeFilter } from '@/lib/filterState'

// Re-export types so importers don't need to know about the lib file
export type { FilterState, FilterAction, SortBy, MediaTypeFilter }

interface FilterBarProps {
  state: FilterState
  dispatch: React.Dispatch<FilterAction>
  totalCount?: number
}

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'timestamp',       label: 'Latest first' },
  { value: 'reach',           label: 'Most reach' },
  { value: 'engagement_rate', label: 'Top engagement' },
  { value: 'score',           label: 'Highest score' },
]

const TYPE_PILLS: Array<{ value: MediaTypeFilter; label: string }> = [
  { value: 'all',            label: 'All' },
  { value: 'IMAGE',          label: 'Images' },
  { value: 'CAROUSEL_ALBUM', label: 'Carousels' },
  { value: 'reel',           label: 'Reels' },
]

export default function FilterBar({ state, dispatch, totalCount }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Content-type pills */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_PILLS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => dispatch({ type: 'SET_FILTER', payload: value })}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              state.mediaTypeFilter === value
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Post count */}
      {totalCount != null && (
        <span className="text-xs text-gray-400">
          {totalCount} post{totalCount !== 1 ? 's' : ''}
        </span>
      )}

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-xs text-gray-500 whitespace-nowrap">
          Sort by
        </label>
        <select
          id="sort-select"
          value={state.sortBy}
          onChange={(e) => dispatch({ type: 'SET_SORT', payload: e.target.value as SortBy })}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
