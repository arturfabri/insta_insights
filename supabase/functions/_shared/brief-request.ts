const VALID_COUNTS = [5, 10, 20] as const

export type BriefCount = (typeof VALID_COUNTS)[number]
export type BriefGoal = 'growth' | 'leads'

export interface BriefRequestBody {
  goal?: string
  count?: number
  accountId?: string
}

export type ParsedBriefRequest =
  | {
      ok: true
      goal: BriefGoal
      count: BriefCount
      accountId: string
    }
  | {
      ok: false
      error: string
    }

export function parseBriefRequest(body: BriefRequestBody): ParsedBriefRequest {
  if (!body.accountId || body.accountId.trim().length === 0) {
    return { ok: false, error: 'accountId is required' }
  }

  if (body.goal !== 'growth' && body.goal !== 'leads') {
    return { ok: false, error: 'goal must be "growth" or "leads"' }
  }

  const count = VALID_COUNTS.includes(body.count as BriefCount)
    ? (body.count as BriefCount)
    : 5

  return {
    ok: true,
    goal: body.goal,
    count,
    accountId: body.accountId,
  }
}
