/**
 * Filter state, action types, and reducer for the Dashboard grid.
 * Kept in a separate file so FilterBar.tsx can be a pure component file
 * (required for React Fast Refresh to work correctly).
 */

export type SortBy = 'timestamp' | 'reach' | 'engagement_rate' | 'score'
export type MediaTypeFilter = 'all' | 'IMAGE' | 'CAROUSEL_ALBUM' | 'reel'

export interface FilterState {
  sortBy: SortBy
  mediaTypeFilter: MediaTypeFilter
}

export type FilterAction =
  | { type: 'SET_SORT';   payload: SortBy }
  | { type: 'SET_FILTER'; payload: MediaTypeFilter }

export function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_SORT':   return { ...state, sortBy: action.payload }
    case 'SET_FILTER': return { ...state, mediaTypeFilter: action.payload }
  }
}

export const INITIAL_FILTER_STATE: FilterState = {
  sortBy: 'timestamp',
  mediaTypeFilter: 'all',
}
