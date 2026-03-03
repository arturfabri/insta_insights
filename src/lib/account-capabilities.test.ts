import { describe, expect, it } from 'vitest'
import {
  buildFacebookOAuthState,
  canUseBusinessDiscovery,
  deriveCapabilityBadge,
  parseFacebookOAuthState,
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
  it('returns meta_upgraded badge and enabled state when fb token is valid', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()

    expect(deriveCapabilityBadge(baseCapability, nowMs)).toBe('meta_upgraded')
    expect(canUseBusinessDiscovery(baseCapability, nowMs)).toBe(true)
  })

  it('returns reconnect-needed badge and disabled state when token is expired', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()
    const expired = {
      ...baseCapability,
      facebook_token_expires_at: '2026-03-01T00:00:00.000Z',
    }

    expect(deriveCapabilityBadge(expired, nowMs)).toBe('meta_reconnect_needed')
    expect(canUseBusinessDiscovery(expired, nowMs)).toBe(false)
  })

  it('returns instagram_only when no capability row exists', () => {
    const nowMs = new Date('2026-03-02T12:00:00.000Z').getTime()

    expect(deriveCapabilityBadge(null, nowMs)).toBe('instagram_only')
    expect(canUseBusinessDiscovery(null, nowMs)).toBe(false)
  })

  it('serializes and parses facebook oauth state with accountId', () => {
    const encoded = buildFacebookOAuthState('account-123')
    const parsed = parseFacebookOAuthState(encoded)

    expect(parsed.error).toBeNull()
    expect(parsed.accountId).toBe('account-123')
  })

  it('returns parse error on invalid oauth state payload', () => {
    const parsed = parseFacebookOAuthState('invalid-base64')

    expect(parsed.accountId).toBeNull()
    expect(parsed.error).toMatch(/parse/i)
  })
})
