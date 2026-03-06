import { z } from 'zod'
import type { InstagramAccountCapabilities } from '@/types/database'

export type ConnectionStatus = 'not_connected' | 'connected' | 'reconnect_required'

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined
const META_GRAPH_VERSION = 'v25.0'
const META_BUSINESS_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
] as const

const BusinessLoginStateSchema = z.object({
  accountId: z.string().trim().min(1).nullable().optional(),
})

const BusinessLoginCallbackParamsSchema = z.object({
  code: z.string().trim().min(1).nullable(),
  state: z.string().trim().min(1).nullable(),
  error: z.string().trim().min(1).nullable(),
  errorDescription: z.string().trim().min(1).nullable(),
})

function isTokenExpired(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return false
  const expiryMs = new Date(expiresAt).getTime()
  if (Number.isNaN(expiryMs)) return true
  return expiryMs <= nowMs
}

export function deriveConnectionStatus(
  capabilities: InstagramAccountCapabilities | null,
  nowMs: number = Date.now(),
): ConnectionStatus {
  if (!capabilities?.facebook_connected) {
    return 'not_connected'
  }

  if (isTokenExpired(capabilities.facebook_token_expires_at, nowMs)) {
    return 'reconnect_required'
  }

  return 'connected'
}

export function canUseBusinessDiscovery(
  capabilities: InstagramAccountCapabilities | null,
  nowMs: number = Date.now(),
): boolean {
  return deriveConnectionStatus(capabilities, nowMs) === 'connected' &&
    Boolean(capabilities?.business_discovery_enabled)
}

export function buildBusinessLoginState(accountId?: string | null): string {
  return window.btoa(JSON.stringify({ accountId: accountId ?? null }))
}

export function parseBusinessLoginState(encodedState: string | null): {
  accountId: string | null
  error: string | null
} {
  if (!encodedState) {
    return { accountId: null, error: 'Missing OAuth state.' }
  }

  try {
    const decoded = window.atob(encodedState)
    const parsed = BusinessLoginStateSchema.safeParse(JSON.parse(decoded))
    if (!parsed.success) {
      return { accountId: null, error: 'Invalid OAuth state.' }
    }

    return { accountId: parsed.data.accountId ?? null, error: null }
  } catch {
    return { accountId: null, error: 'Failed to parse OAuth state.' }
  }
}

export function parseBusinessLoginCallbackParams(searchParams: URLSearchParams) {
  const parsed = BusinessLoginCallbackParamsSchema.safeParse({
    code: searchParams.get('code'),
    state: searchParams.get('state'),
    error: searchParams.get('error'),
    errorDescription: searchParams.get('error_description'),
  })

  if (!parsed.success) {
    return {
      code: null,
      state: null,
      error: null,
      errorDescription: null,
      validationError: 'Invalid callback parameters returned from Meta.',
    }
  }

  return {
    ...parsed.data,
    validationError: null,
  }
}

export function buildBusinessLoginUrl(accountId?: string | null): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID ?? '',
    redirect_uri: `${window.location.origin}/oauth/facebook-callback`,
    scope: META_BUSINESS_LOGIN_SCOPES.join(','),
    response_type: 'code',
    state: buildBusinessLoginState(accountId),
    enable_fb_login: 'true',
  })

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}
