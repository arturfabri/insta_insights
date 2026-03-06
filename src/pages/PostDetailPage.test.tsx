import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PostDetailPage from './PostDetailPage'
import type { InstagramMediaWithInsights } from '@/types/database'
import type { ComputedScore } from '@/types/scoring'

const mockUseMediaDetail = vi.fn()
const mockUseMediaList = vi.fn()
const mockUseScoringEngine = vi.fn()
const mockUsePersistScores = vi.fn()

vi.mock('@/hooks/useMediaDetail', () => ({
  useMediaDetail: (...args: unknown[]) => mockUseMediaDetail(...args),
}))

vi.mock('@/hooks/useMediaList', () => ({
  useMediaList: (...args: unknown[]) => mockUseMediaList(...args),
}))

vi.mock('@/hooks/useScoringEngine', () => ({
  useScoringEngine: (...args: unknown[]) => mockUseScoringEngine(...args),
}))

vi.mock('@/hooks/usePersistScores', () => ({
  usePersistScores: (...args: unknown[]) => mockUsePersistScores(...args),
}))

function makeMedia(overrides: Partial<InstagramMediaWithInsights> = {}): InstagramMediaWithInsights {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    media_id: 'ig-1',
    media_type: 'VIDEO',
    is_reel: true,
    caption: 'A full detail caption',
    permalink: 'https://instagram.com/p/test',
    thumbnail_url: 'https://cdn.example.com/thumb.jpg',
    media_url: 'https://cdn.example.com/media.jpg',
    timestamp: '2025-01-01T12:00:00Z',
    duration_seconds: 95,
    media_product_type: 'REELS',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-02T12:00:00Z',
    insights: {
      id: '00000000-0000-4000-8000-000000000020',
      media_id_fk: '00000000-0000-4000-8000-000000000001',
      user_id: '00000000-0000-4000-8000-000000000011',
      reach: 1200,
      impressions: 1400,
      plays: 900,
      video_views: 850,
      views: 910,
      total_interactions: 320,
      profile_activity: 27,
      replies: 11,
      reposts: 4,
      reels_skip_rate: 0.22,
      crossposted_views: 190,
      facebook_views: 75,
      completion_rate: 0.41,
      avg_watch_time_sec: 18,
      total_watch_time_ms: 125000,
      likes: 240,
      comments: 34,
      shares: 19,
      saves: 48,
      profile_visits: 20,
      follows: 7,
      engagement_rate: 0.18,
      synced_at: '2025-01-03T12:00:00Z',
    },
    ...overrides,
  }
}

function makeScore(overrides: Partial<ComputedScore> = {}): ComputedScore {
  return {
    mediaId: '00000000-0000-4000-8000-000000000001',
    goal: 'growth',
    totalScore: 82,
    distributionScore: 80,
    engagementDepthScore: 75,
    conversionScore: 68,
    retentionScore: 84,
    valueScore: null,
    considerationScore: null,
    weightsSnapshot: {},
    ...overrides,
  }
}

function renderPostDetail(route = '/posts/00000000-0000-4000-8000-000000000001') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/posts/:id" element={<PostDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PostDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const media = makeMedia()

    mockUseMediaDetail.mockReturnValue({
      media,
      loading: false,
      error: null,
    })
    mockUseMediaList.mockReturnValue({
      media: [media],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    mockUseScoringEngine.mockReturnValue(new Map([[media.id, makeScore()]]))
    mockUsePersistScores.mockImplementation(() => {})
  })

  it('renders grouped media and insights sections with advanced metrics', () => {
    renderPostDetail()

    expect(screen.getByRole('heading', { name: 'Media Overview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Core Insights' })).toBeInTheDocument()
    const advancedSection = screen.getByRole('heading', { name: 'Advanced Insights' }).closest('section')
    expect(screen.getByRole('heading', { name: 'Sync / Data Status' })).toBeInTheDocument()
    expect(advancedSection).not.toBeNull()
    expect(screen.getByText('Instagram media ID')).toBeInTheDocument()
    expect(screen.getByText('ig-1')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('Facebook views')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('75')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('Completion rate')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('41.0%')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('Total watch time')).toBeInTheDocument()
    expect(within(advancedSection!).getByText('2m 5s')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /growth score/i })).toBeInTheDocument()
  })

  it('shows explicit unavailable states instead of hiding null advanced fields', () => {
    const media = makeMedia({
      insights: {
        ...makeMedia().insights!,
        facebook_views: null,
        completion_rate: null,
        total_watch_time_ms: null,
        crossposted_views: null,
        views: null,
      },
    })

    mockUseMediaDetail.mockReturnValue({
      media,
      loading: false,
      error: null,
    })
    mockUseMediaList.mockReturnValue({
      media: [media],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderPostDetail()

    expect(screen.getByText('Facebook views')).toBeInTheDocument()
    expect(screen.getByText('Completion rate')).toBeInTheDocument()
    expect(screen.getByText('Total watch time')).toBeInTheDocument()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/views, crossposted views, facebook views, completion rate, total watch time/i)).toBeInTheDocument()
  })

  it('preserves the not-found state when no media is returned', () => {
    mockUseMediaDetail.mockReturnValue({
      media: null,
      loading: false,
      error: null,
    })
    mockUseScoringEngine.mockReturnValue(new Map())

    renderPostDetail()

    expect(screen.getByRole('heading', { name: /post not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/')
  })
})
