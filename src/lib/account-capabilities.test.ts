import { describe, expect, it } from 'vitest'
import {
  buildBusinessLoginState,
  buildBusinessLoginUrl,
  canUseBusinessDiscovery,
  deriveConnectionStatus,
  parseBusinessLoginCallbackParams,
  parseBusinessLoginState,
} from './account-capabilities'
import type { InstagramAccountCapabilities } from '@/types/database'

const baseCapability: InstagramAccountCapabilities = {
  account_id: 'a1',
  user_id: 'u1',
  instagram_connected: true,
  facebook_connected: true,
  business_discovery_enabled: true,
  facebook_token_expires_at: '2030-01-01T00:00:00.000Z',
  status_reason: 'meta_upgraded',
  last_validated_at: '2026-03-02T00:00:00.000Z',
  created_at: '2026-03-02T00:00:00.000Z',
  updated_at: '2026-03-02T00:00:00.000Z',
}

describe('account capability helpers', () => {
  it('returns connected state and enabled business discovery when token is valid', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()

    expect(deriveConnectionStatus(baseCapability, nowMs)).toBe('connected')
    expect(canUseBusinessDiscovery(baseCapability, nowMs)).toBe(true)
  })

  it('returns reconnect-required and disabled state when token is expired', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()
    const expired = {
      ...baseCapability,
      facebook_token_expires_at: '2026-03-01T00:00:00.000Z',
    }

    expect(deriveConnectionStatus(expired, nowMs)).toBe('reconnect_required')
    expect(canUseBusinessDiscovery(expired, nowMs)).toBe(false)
  })

  it('returns not_connected when no capability row exists', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()

    expect(deriveConnectionStatus(null, nowMs)).toBe('not_connected')
    expect(canUseBusinessDiscovery(null, nowMs)).toBe(false)
  })

  it('serializes and parses business login state with accountId', () => {
    const encoded = buildBusinessLoginState('account-123')
    const parsed = parseBusinessLoginState(encoded)

    expect(parsed.error).toBeNull()
    expect(parsed.accountId).toBe('account-123')
  })

  it('serializes and parses business login state without an accountId for first-time connect', () => {
    const encoded = buildBusinessLoginState(null)
    const parsed = parseBusinessLoginState(encoded)

    expect(parsed.error).toBeNull()
    expect(parsed.accountId).toBeNull()
  })

  it('returns parse error on invalid oauth state payload', () => {
    const parsed = parseBusinessLoginState('invalid-base64')

    expect(parsed.accountId).toBeNull()
    expect(parsed.error).toMatch(/parse/i)
  })

  it('builds the Business Login URL with v25 scopes and fb login enabled', () => {
    const url = new URL(buildBusinessLoginUrl('account-123'))

    expect(url.pathname).toBe('/v25.0/dialog/oauth')
    expect(url.searchParams.get('enable_fb_login')).toBe('true')
    expect(url.searchParams.get('scope')).toBe(
      'instagram_business_basic,instagram_business_manage_insights,pages_show_list,pages_read_engagement',
    )
  })

  it('validates callback params from the Meta redirect', () => {
    const params = new URLSearchParams({
      code: 'auth-code',
      state: buildBusinessLoginState('account-123'),
    })

    expect(parseBusinessLoginCallbackParams(params)).toEqual({
      code: 'auth-code',
      state: params.get('state'),
      error: null,
      errorDescription: null,
      validationError: null,
    })
  })
})
