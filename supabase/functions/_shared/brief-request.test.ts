import { describe, expect, it } from 'vitest'
import { parseBriefRequest } from './brief-request'

describe('parseBriefRequest', () => {
  it('rejects missing accountId', () => {
    const result = parseBriefRequest({ goal: 'growth', count: 5 })
    expect(result).toEqual({ ok: false, error: 'accountId is required' })
  })

  it('rejects invalid goal', () => {
    const result = parseBriefRequest({ goal: 'invalid', count: 5, accountId: 'acc-1' })
    expect(result).toEqual({ ok: false, error: 'goal must be "growth" or "leads"' })
  })

  it('defaults count to 5 when unsupported value is provided', () => {
    const result = parseBriefRequest({ goal: 'growth', count: 17, accountId: 'acc-1' })

    expect(result).toEqual({
      ok: true,
      goal: 'growth',
      count: 5,
      accountId: 'acc-1',
    })
  })
})
