import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import InsightsPage from './InsightsPage'

const mockUseAccountInsights = vi.fn()

vi.mock('@/hooks/useAccountInsights', () => ({
  useAccountInsights: () => mockUseAccountInsights(),
}))

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div style={{ width: 800, height: 320 }}>{children}</div>
    ),
  }
})

function makeRow(metricDate: string, metricType: 'time_series' | 'total_value', overrides: Record<string, unknown> = {}) {
  return {
    account_id: '00000000-0000-4000-8000-000000000010',
    user_id: '00000000-0000-4000-8000-000000000011',
    metric_date: metricDate,
    metric_type: metricType,
    timeframe: '',
    accounts_engaged: null,
    reach: null,
    views: null,
    total_interactions: null,
    likes: null,
    comments: null,
    replies: null,
    shares: null,
    saves: null,
    reposts: null,
    profile_links_taps: null,
    follows: null,
    unfollows: null,
    net_follower_growth: null,
    updated_at: `${metricDate}T10:00:00Z`,
    ...overrides,
  }
}

function renderInsightsPage() {
  return render(
    <MemoryRouter>
      <InsightsPage />
    </MemoryRouter>,
  )
}

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccountInsights.mockReturnValue({
      account: {
        id: '00000000-0000-4000-8000-000000000010',
        user_id: '00000000-0000-4000-8000-000000000011',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00Z',
        last_synced_at: null,
        sync_status: 'complete',
        sync_error: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      },
      insights: [
        makeRow('2026-01-10', 'time_series', { reach: 300 }),
        makeRow('2026-01-10', 'total_value', { views: 120, total_interactions: 45, likes: 9, accounts_engaged: 50, follows: 7, unfollows: 2, net_follower_growth: 5 }),
        makeRow('2026-02-25', 'time_series', { reach: 100 }),
        makeRow('2026-02-25', 'total_value', { views: 60, total_interactions: 20, likes: 5, profile_links_taps: 1 }),
        makeRow('2026-02-26', 'total_value', { accounts_engaged: 80, follows: 10, unfollows: 3, net_follower_growth: 7 }),
        makeRow('2026-03-01', 'time_series', { reach: 200 }),
        makeRow('2026-03-01', 'total_value', { views: 90, total_interactions: 40, comments: 8, replies: 2, shares: 4 }),
        makeRow('2026-03-02', 'total_value', { accounts_engaged: 120, follows: 15, unfollows: 5, net_follower_growth: 10 }),
        makeRow('2026-03-15', 'time_series', { reach: 400 }),
        makeRow('2026-03-15', 'total_value', { views: 200, total_interactions: 75, saves: 9, reposts: 2, accounts_engaged: 180, follows: 20, unfollows: 6, net_follower_growth: 14 }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('renders the header, KPI cards, and chart sections', () => {
    renderInsightsPage()

    expect(screen.getByRole('heading', { name: /account insights/i })).toBeInTheDocument()
    expect(screen.getByText('@creator')).toBeInTheDocument()
    expect(screen.getByLabelText('Reach KPI')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Performance Trend' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Interaction Mix' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Audience Growth' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Profile Action' })).toBeInTheDocument()
    expect(screen.getByText(/accounts engaged keeps the latest visible daily value/i)).toBeInTheDocument()
  })

  it('switches totals when the granularity changes', () => {
    renderInsightsPage()

    expect(screen.getByLabelText('Reach KPI')).toHaveTextContent('700')

    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    expect(screen.getByLabelText('Reach KPI')).toHaveTextContent('1K')
  })

  it('shows connect prompt when no account exists', () => {
    mockUseAccountInsights.mockReturnValue({
      account: null,
      insights: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderInsightsPage()

    expect(screen.getByText(/connect an account first/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to connect/i })).toHaveAttribute('href', '/connect')
  })

  it('keeps empty account-insights recovery on /connect only', () => {
    mockUseAccountInsights.mockReturnValue({
      account: {
        id: '00000000-0000-4000-8000-000000000010',
        user_id: '00000000-0000-4000-8000-000000000011',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00Z',
        last_synced_at: '2026-03-01T00:00:00Z',
        sync_status: 'complete',
        sync_error: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      },
      insights: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderInsightsPage()

    expect(screen.getByText(/no account insights yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to connect/i })).toHaveAttribute('href', '/connect')
    expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument()
  })

  it('shows the error state before the connect prompt when account loading fails', () => {
    mockUseAccountInsights.mockReturnValue({
      account: null,
      insights: [],
      loading: false,
      error: 'Multiple Instagram accounts are linked to this user.',
      refetch: vi.fn(),
    })

    renderInsightsPage()

    expect(screen.getByText(/failed to load account insights/i)).toBeInTheDocument()
    expect(screen.queryByText(/connect an account first/i)).not.toBeInTheDocument()
  })

  it('shows unavailable sections for missing metric families', () => {
    mockUseAccountInsights.mockReturnValue({
      account: {
        id: '00000000-0000-4000-8000-000000000010',
        user_id: '00000000-0000-4000-8000-000000000011',
        instagram_user_id: 'ig-1',
        username: 'creator',
        token_expires_at: '2030-01-01T00:00:00Z',
        last_synced_at: null,
        sync_status: 'complete',
        sync_error: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      },
      insights: [
        makeRow('2026-03-15', 'time_series', { reach: 400, views: 200, total_interactions: 75 }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderInsightsPage()

    expect(screen.getByText(/audience growth metrics are not available/i)).toBeInTheDocument()
    expect(screen.getByText(/profile link taps are not available/i)).toBeInTheDocument()
  })

  it('shows replies in the interaction summary when available', () => {
    renderInsightsPage()

    expect(screen.getByText('Replies')).toBeInTheDocument()
  })
})
