import { describe, expect, it } from 'vitest'
import { sanitizeProviderError } from './provider-error'

describe('sanitizeProviderError', () => {
  it('returns parsed provider error with code and no token leakage', () => {
    const body = JSON.stringify({
      error: {
        code: 190,
        message: 'Invalid OAuth access token: access_token=abc123',
      },
    })

    const result = sanitizeProviderError(400, body)

    expect(result).toContain('HTTP 400 [190]')
    expect(result).not.toContain('abc123')
    expect(result).toContain('access_token=[redacted]')
  })

  it('handles plain text responses and strips token fields', () => {
    const result = sanitizeProviderError(500, 'failure "access_token":"super-secret"')

    expect(result).toContain('HTTP 500')
    expect(result).not.toContain('super-secret')
    expect(result).toContain('"access_token":"[redacted]"')
  })
})
