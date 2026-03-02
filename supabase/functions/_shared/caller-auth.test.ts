import { describe, expect, it, vi } from 'vitest'
import { resolveCallerAuth } from './caller-auth'

function makeSupabase(userId: string | null, hasError = false) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: hasError ? new Error('invalid token') : null,
      }),
    },
  }
}

describe('resolveCallerAuth', () => {
  it('accepts user bearer token when valid', async () => {
    const req = new Request('https://example.test', {
      headers: { Authorization: 'Bearer valid-jwt' },
    })

    const result = await resolveCallerAuth(req, makeSupabase('user-1'), 'cron-secret')

    expect(result).toEqual({
      success: true,
      caller: { kind: 'user', userId: 'user-1' },
    })
  })

  it('accepts cron caller with valid cron secret', async () => {
    const req = new Request('https://example.test', {
      headers: { 'X-Cron-Secret': 'cron-secret' },
    })

    const result = await resolveCallerAuth(req, makeSupabase(null), 'cron-secret')

    expect(result).toEqual({ success: true, caller: { kind: 'cron' } })
  })

  it('rejects when neither auth path is valid', async () => {
    const req = new Request('https://example.test', {
      headers: { Authorization: 'Bearer invalid' },
    })

    const result = await resolveCallerAuth(req, makeSupabase(null, true), 'cron-secret')

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
  })

  it('falls back to cron mode when bearer is invalid but cron secret is valid', async () => {
    const req = new Request('https://example.test', {
      headers: {
        Authorization: 'Bearer invalid',
        'X-Cron-Secret': 'cron-secret',
      },
    })

    const result = await resolveCallerAuth(req, makeSupabase(null, true), 'cron-secret')

    expect(result).toEqual({ success: true, caller: { kind: 'cron' } })
  })
})
