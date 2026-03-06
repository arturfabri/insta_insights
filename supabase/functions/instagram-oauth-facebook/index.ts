import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4.3.6'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/crypto.ts'
import { sanitizeProviderError } from '../_shared/provider-error.ts'
import {
  isMissingColumnError,
  isMissingRelationError,
  isNotNullViolationForColumn,
} from '../_shared/token-store.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const META_GRAPH_VERSION = 'v25.0'
const BUSINESS_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
] as const

const BusinessLoginRequestSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().trim().url(),
  accountId: z.string().trim().min(1).nullable().optional(),
})

const ShortLivedTokenSchema = z.object({
  access_token: z.string().trim().min(1),
})

const LongLivedTokenSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: z.number().int().positive().optional(),
})

const InstagramProfileSchema = z.object({
  id: z.string().trim().min(1),
  username: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
})

function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('Missing authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) return fail('Invalid token')

    const rawBody = await req.json().catch(() => null)
    const parsedBody = BusinessLoginRequestSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return fail('Invalid request payload for Business Login exchange')
    }

    const { code, redirectUri, accountId } = parsedBody.data

    const shortTokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`)
    shortTokenUrl.searchParams.set('client_id', META_APP_ID)
    shortTokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    shortTokenUrl.searchParams.set('redirect_uri', redirectUri)
    shortTokenUrl.searchParams.set('code', code)

    const shortTokenRes = await fetch(shortTokenUrl.toString())
    const shortTokenBody = await shortTokenRes.text()
    if (!shortTokenRes.ok) {
      const safeError = sanitizeProviderError(shortTokenRes.status, shortTokenBody)
      return fail(`Business Login short token exchange failed: ${safeError}`)
    }

    const shortTokenParsed = ShortLivedTokenSchema.safeParse(JSON.parse(shortTokenBody))
    if (!shortTokenParsed.success) {
      return fail('Business Login did not return a valid short-lived token')
    }

    const longTokenUrl = new URL('https://graph.instagram.com/access_token')
    longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longTokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    longTokenUrl.searchParams.set('access_token', shortTokenParsed.data.access_token)

    const longTokenRes = await fetch(longTokenUrl.toString())
    const longTokenBody = await longTokenRes.text()
    if (!longTokenRes.ok) {
      const safeError = sanitizeProviderError(longTokenRes.status, longTokenBody)
      return fail(`Business Login long token exchange failed: ${safeError}`)
    }

    const longTokenParsed = LongLivedTokenSchema.safeParse(JSON.parse(longTokenBody))
    if (!longTokenParsed.success) {
      return fail('Business Login did not return a valid long-lived token')
    }

    const meUrl = new URL('https://graph.instagram.com/me')
    meUrl.searchParams.set('fields', 'id,username,name')
    meUrl.searchParams.set('access_token', longTokenParsed.data.access_token)

    const meRes = await fetch(meUrl.toString())
    const meBody = await meRes.text()
    if (!meRes.ok) {
      const safeError = sanitizeProviderError(meRes.status, meBody)
      return fail(`Failed to fetch Instagram profile: ${safeError}`)
    }

    const instagramProfile = InstagramProfileSchema.safeParse(JSON.parse(meBody))
    if (!instagramProfile.success) {
      return fail('Business Login returned an invalid Instagram profile payload')
    }

    const instagramUserId = instagramProfile.data.id
    const username =
      instagramProfile.data.username ??
      instagramProfile.data.name ??
      instagramUserId

    const encryptedToken = await encryptToken(
      longTokenParsed.data.access_token,
      TOKEN_ENCRYPTION_KEY,
    )
    const tokenExpiresAt =
      typeof longTokenParsed.data.expires_in === 'number'
        ? new Date(
            Date.now() + Math.max(0, longTokenParsed.data.expires_in - 86400) * 1000,
          ).toISOString()
        : null

    let resolvedAccountId = accountId ?? null

    if (resolvedAccountId) {
      const { data: accountRow, error: accountError } = await supabase
        .from('instagram_accounts')
        .select('id, user_id, instagram_user_id')
        .eq('id', resolvedAccountId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (accountError || !accountRow) {
        return fail('Instagram account not found for user')
      }

      if (accountRow.instagram_user_id !== instagramUserId) {
        return fail('Meta Business Login returned a different Instagram account than the selected record')
      }

      const { error: accountUpdateError } = await supabase
        .from('instagram_accounts')
        .update({
          username,
          token_expires_at: tokenExpiresAt,
          sync_error: null,
        })
        .eq('id', accountRow.id)
        .eq('user_id', accountRow.user_id)

      if (accountUpdateError) {
        return fail(`Failed to refresh Instagram account metadata: ${accountUpdateError.message}`)
      }
    } else {
      const accountPayload = {
        user_id: user.id,
        instagram_user_id: instagramUserId,
        username,
        token_expires_at: tokenExpiresAt,
        sync_status: 'pending' as const,
        sync_error: null,
      }

      let { data: accountRow, error: upsertError } = await supabase
        .from('instagram_accounts')
        .upsert(accountPayload, { onConflict: 'user_id,instagram_user_id' })
        .select('id, user_id')
        .single()

      const needsLegacyAccountWrite = isNotNullViolationForColumn(upsertError, 'access_token_enc')
      if (needsLegacyAccountWrite) {
        const retry = await supabase
          .from('instagram_accounts')
          .upsert(
            {
              ...accountPayload,
              access_token_enc: encryptedToken,
            },
            { onConflict: 'user_id,instagram_user_id' },
          )
          .select('id, user_id')
          .single()
        accountRow = retry.data
        upsertError = retry.error
      }

      if (upsertError || !accountRow) {
        return fail(`Failed to upsert Instagram account: ${upsertError?.message ?? 'No account row returned'}`)
      }

      resolvedAccountId = accountRow.id
    }

    const { data: resolvedAccountRow, error: resolvedAccountError } = await supabase
      .from('instagram_accounts')
      .select('id, user_id')
      .eq('id', resolvedAccountId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (resolvedAccountError || !resolvedAccountRow) {
      return fail('Resolved Instagram account row not found after Business Login')
    }

    const { error: primaryTokenError } = await supabase
      .from('instagram_account_tokens')
      .upsert(
        {
          account_id: resolvedAccountRow.id,
          user_id: resolvedAccountRow.user_id,
          access_token_enc: encryptedToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' },
      )

    if (primaryTokenError) {
      if (isMissingRelationError(primaryTokenError)) {
        const { error: legacyUpdateError } = await supabase
          .from('instagram_accounts')
          .update({ access_token_enc: encryptedToken })
          .eq('id', resolvedAccountRow.id)
          .eq('user_id', resolvedAccountRow.user_id)

        if (legacyUpdateError && !isMissingColumnError(legacyUpdateError)) {
          return fail(`Failed to store primary token: ${legacyUpdateError.message}`)
        }
      } else {
        return fail(`Failed to store primary token: ${primaryTokenError.message}`)
      }
    }

    const { error: fbTokenError } = await supabase
      .from('instagram_account_fb_tokens')
      .upsert(
        {
          account_id: resolvedAccountRow.id,
          user_id: resolvedAccountRow.user_id,
          access_token_enc: encryptedToken,
          token_expires_at: tokenExpiresAt,
          granted_scopes: [...BUSINESS_LOGIN_SCOPES],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' },
      )

    if (fbTokenError) {
      return fail(`Failed to store Business Login token: ${fbTokenError.message}`)
    }

    const nowIso = new Date().toISOString()
    const { error: capabilityUpsertError } = await supabase
      .from('instagram_account_capabilities')
      .upsert(
        {
          account_id: resolvedAccountRow.id,
          user_id: resolvedAccountRow.user_id,
          instagram_connected: true,
          facebook_connected: true,
          business_discovery_enabled: true,
          facebook_token_expires_at: tokenExpiresAt,
          status_reason: 'meta_upgraded',
          last_validated_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'account_id' },
      )

    if (capabilityUpsertError && !isMissingRelationError(capabilityUpsertError)) {
      return fail(`Failed to update capability state: ${capabilityUpsertError.message}`)
    }

    if (capabilityUpsertError && isMissingRelationError(capabilityUpsertError)) {
      console.warn('Capability table missing; stored tokens without capability projection update')
    }

    return ok({
      success: true,
      accountId: resolvedAccountRow.id,
      instagramUserId,
      username,
      grantedScopes: [...BUSINESS_LOGIN_SCOPES],
    })
  } catch (err) {
    return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  }
})
