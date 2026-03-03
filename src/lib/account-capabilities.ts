import type { InstagramAccountCapabilities } from '@/types/database'

export type CapabilityBadge = 'instagram_only' | 'meta_upgraded' | 'meta_reconnect_needed'

function isTokenExpired(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return false
  const expiryMs = new Date(expiresAt).getTime()
  if (Number.isNaN(expiryMs)) return true
  return expiryMs <= nowMs
}

export function canUseBusinessDiscovery(
  capabilities: InstagramAccountCapabilities | null,
  nowMs: number = Date.now(),
): boolean {
  if (!capabilities) return false
  if (!capabilities.facebook_connected || !capabilities.business_discovery_enabled) return false
  return !isTokenExpired(capabilities.facebook_token_expires_at, nowMs)
}

export function deriveCapabilityBadge(
  capabilities: InstagramAccountCapabilities | null,
  nowMs: number = Date.now(),
): CapabilityBadge {
  if (!capabilities || !capabilities.facebook_connected) {
    return 'instagram_only'
  }

  if (isTokenExpired(capabilities.facebook_token_expires_at, nowMs)) {
    return 'meta_reconnect_needed'
  }

  if (capabilities.business_discovery_enabled) {
    return 'meta_upgraded'
  }

  return 'instagram_only'
}

export function buildFacebookOAuthState(accountId: string): string {
  return window.btoa(JSON.stringify({ accountId }))
}

export function parseFacebookOAuthState(encodedState: string | null): { accountId: string | null; error: string | null } {
  if (!encodedState) {
    return { accountId: null, error: 'Missing account context in OAuth state.' }
  }

  try {
    const decoded = window.atob(encodedState)
    const parsed = JSON.parse(decoded) as { accountId?: unknown }

    if (typeof parsed.accountId !== 'string' || parsed.accountId.trim().length === 0) {
      return { accountId: null, error: 'Invalid account context in OAuth state.' }
    }

    return { accountId: parsed.accountId, error: null }
  } catch {
    return { accountId: null, error: 'Failed to parse OAuth state.' }
  }
}
