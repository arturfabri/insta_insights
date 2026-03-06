import type { MetricFactRow } from './metric-facts.ts'

export interface AccountInsightsDailyProjectionRow {
  account_id: string
  user_id: string
  metric_date: string
  metric_type: 'total_value' | 'time_series'
  timeframe: string
  accounts_engaged: number | null
  reach: number | null
  views: number | null
  total_interactions: number | null
  likes: number | null
  comments: number | null
  replies: number | null
  shares: number | null
  saves: number | null
  reposts: number | null
  profile_links_taps: number | null
  follows: number | null
  unfollows: number | null
  net_follower_growth: number | null
}

function createRow(
  accountId: string,
  userId: string,
  metricDate: string,
  metricType: 'total_value' | 'time_series',
  timeframe: string,
): AccountInsightsDailyProjectionRow {
  return {
    account_id: accountId,
    user_id: userId,
    metric_date: metricDate,
    metric_type: metricType,
    timeframe,
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
  }
}

/**
 * Projects account-scoped metric facts into the wide daily table consumed by
 * `/insights`. Demographic and other JSON-only metrics stay in facts storage
 * because they do not fit the daily chart projection.
 */
export function projectAccountFactsToDailyRows(
  facts: MetricFactRow[],
  accountId: string,
  userId: string,
  metricType: 'total_value' | 'time_series',
): AccountInsightsDailyProjectionRow[] {
  const rowsByDate = new Map<string, AccountInsightsDailyProjectionRow>()

  for (const fact of facts) {
    const key = `${fact.metric_date}|${fact.timeframe}`
    const row = rowsByDate.get(key) ?? createRow(accountId, userId, fact.metric_date, metricType, fact.timeframe)
    let handled = true

    switch (fact.metric_name) {
      case 'accounts_engaged':
        row.accounts_engaged = fact.metric_value_numeric
        break
      case 'reach':
        row.reach = fact.metric_value_numeric
        break
      case 'views':
        row.views = fact.metric_value_numeric
        break
      case 'total_interactions':
        row.total_interactions = fact.metric_value_numeric
        break
      case 'likes':
        row.likes = fact.metric_value_numeric
        break
      case 'comments':
        row.comments = fact.metric_value_numeric
        break
      case 'replies':
        row.replies = fact.metric_value_numeric
        break
      case 'shares':
        row.shares = fact.metric_value_numeric
        break
      case 'saves':
        row.saves = fact.metric_value_numeric
        break
      case 'reposts':
        row.reposts = fact.metric_value_numeric
        break
      case 'profile_links_taps':
        row.profile_links_taps = fact.metric_value_numeric
        break
      case 'follows_and_unfollows':
        if (fact.metric_value_jsonb && typeof fact.metric_value_jsonb === 'object') {
          const followsValue = Number((fact.metric_value_jsonb as Record<string, unknown>).follows ?? 0)
          const unfollowsValue = Number((fact.metric_value_jsonb as Record<string, unknown>).unfollows ?? 0)
          row.follows = Number.isFinite(followsValue) ? followsValue : 0
          row.unfollows = Number.isFinite(unfollowsValue) ? unfollowsValue : 0
          row.net_follower_growth = (row.follows ?? 0) - (row.unfollows ?? 0)
        } else {
          handled = false
        }
        break
      default:
        handled = false
        break
    }

    if (handled) {
      rowsByDate.set(key, row)
    }
  }

  return [...rowsByDate.values()]
}
