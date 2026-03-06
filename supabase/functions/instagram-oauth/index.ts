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
import {
  REQUESTED_ACCOUNT_MISMATCH_MESSAGE,
  resolveSingleAccountLink,
} from '../_shared/single-account-enforcement.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const InstagramLoginRequestSchema = z.object({
  code: z.string().trim().min(1),
  redirectUri: z.string().trim().url(),
  accountId: z.string().trim().min(1).nullable().optional(),
})

// Always return HTTP 200 so the Supabase client puts the body in `data` (not in error).
// Callers check `data.success` to detect failures.
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
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify authenticated user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('Missing authorization header')

    // Create admin client to verify user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) return fail('Invalid token')

    const rawBody = await req.json().catch(() => null)
    const parsedBody = InstagramLoginRequestSchema.safeParse(rawBody)

    if (!parsedBody.success) return fail('Invalid request payload for Instagram Login exchange')

    const { code, redirectUri, accountId } = parsedBody.data

    // Step 1: Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    })

    const shortLivedRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenParams,
    })

    const shortLivedBody = await shortLivedRes.text()

    if (!shortLivedRes.ok) {
      const safeError = sanitizeProviderError(shortLivedRes.status, shortLivedBody)
      console.error('Step1 (code→short token) failed:', safeError)
      return fail(`Step1 (code→short token): ${safeError}`)
    }

    const { access_token: shortLivedToken } = JSON.parse(shortLivedBody) as { access_token: string }

    // Step 2: Exchange for long-lived token (valid 60 days)
    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
    longLivedUrl.searchParams.set('access_token', shortLivedToken)

    const longLivedRes = await fetch(longLivedUrl.toString())
    const longLivedBody = await longLivedRes.text()

    if (!longLivedRes.ok) {
      const safeError = sanitizeProviderError(longLivedRes.status, longLivedBody)
      console.error('Step2 (short→long token) failed:', safeError)
      return fail(`Step2 (short→long token): ${safeError}`)
    }

    const { access_token: longLivedToken, expires_in } = JSON.parse(longLivedBody) as {
      access_token: string
      expires_in: number
    }

    // Step 3: Fetch Instagram user info
    const meUrl = new URL('https://graph.instagram.com/me')
    meUrl.searchParams.set('fields', 'id,username,name')
    meUrl.searchParams.set('access_token', longLivedToken)

    const meRes = await fetch(meUrl.toString())
    const meBody = await meRes.text()

    if (!meRes.ok) {
      const safeError = sanitizeProviderError(meRes.status, meBody)
      console.error('Step3 (/me) failed:', safeError)
      return fail(`Step3 (/me): ${safeError}`)
    }

    const meData = JSON.parse(meBody) as { id: string; username?: string; name?: string }
    const instagramUserId = meData.id
    const username = meData.username ?? meData.name ?? instagramUserId

    // Step 4: Encrypt the long-lived token
    const encryptedToken = await encryptToken(longLivedToken, TOKEN_ENCRYPTION_KEY)

    // expires_in is in seconds; subtract 1 day as buffer
    const tokenExpiresAt = new Date(
      Date.now() + (expires_in - 86400) * 1000
    ).toISOString()

    let accountRow: { id: string; user_id: string } | null = null

    if (accountId) {
      const { data: requestedAccount, error: requestedAccountError } = await supabase
        .from('instagram_accounts')
        .select('id, user_id, instagram_user_id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (requestedAccountError || !requestedAccount) {
        return fail('Instagram account not found for user')
      }

      if (requestedAccount.instagram_user_id !== instagramUserId) {
        return fail(REQUESTED_ACCOUNT_MISMATCH_MESSAGE)
      }

      const { error: accountUpdateError } = await supabase
        .from('instagram_accounts')
        .update({
          username,
          token_expires_at: tokenExpiresAt,
          sync_error: null,
        })
        .eq('id', requestedAccount.id)
        .eq('user_id', requestedAccount.user_id)

      if (accountUpdateError) {
        return fail(`Step5 (account update): ${accountUpdateError.message}`)
      }

      accountRow = { id: requestedAccount.id, user_id: requestedAccount.user_id }
    } else {
      const { data: existingAccountRows, error: existingAccountsError } = await supabase
        .from('instagram_accounts')
        .select('id, instagram_user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(2)

      if (existingAccountsError) {
        return fail(`Step5 (existing account lookup): ${existingAccountsError.message}`)
      }

      if ((existingAccountRows?.length ?? 0) > 1) {
        return fail('Multiple Instagram accounts are linked to this user. Resolve duplicates before continuing.')
      }

      const resolution = resolveSingleAccountLink(
        existingAccountRows?.[0]
          ? {
              id: existingAccountRows[0].id,
              instagram_user_id: existingAccountRows[0].instagram_user_id,
            }
          : null,
        instagramUserId,
      )

      if (resolution.kind === 'different_account_conflict') {
        return fail(resolution.message)
      }

      const accountPayload = {
        user_id: user.id,
        instagram_user_id: instagramUserId,
        username,
        token_expires_at: tokenExpiresAt,
        sync_status: 'pending' as const,
        sync_error: null,
      }

      if (resolution.kind === 'reuse_existing_account') {
        const { error: accountUpdateError } = await supabase
          .from('instagram_accounts')
          .update({
            username,
            token_expires_at: tokenExpiresAt,
            sync_error: null,
          })
          .eq('id', resolution.accountId)
          .eq('user_id', user.id)

        if (accountUpdateError) {
          return fail(`Step5 (account update): ${accountUpdateError.message}`)
        }

        accountRow = { id: resolution.accountId, user_id: user.id }
      } else {
        let insertResult = await supabase
          .from('instagram_accounts')
          .insert(accountPayload)
          .select('id, user_id')
          .single()

        if (isNotNullViolationForColumn(insertResult.error, 'access_token_enc')) {
          console.warn('Legacy schema detected (access_token_enc NOT NULL); retrying account insert with token column')
          insertResult = await supabase
            .from('instagram_accounts')
            .insert({
              ...accountPayload,
              access_token_enc: encryptedToken,
            })
            .select('id, user_id')
            .single()
        }

        if (insertResult.error || !insertResult.data) {
          console.error('DB insert error:', insertResult.error)
          return fail(`Step5 (DB insert): ${insertResult.error?.message ?? 'No account row returned'}`)
        }

        accountRow = insertResult.data
      }
    }

    if (!accountRow) {
      return fail('Step5 (account resolution): no account row available after OAuth')
    }

    const { error: tokenError } = await supabase
      .from('instagram_account_tokens')
      .upsert(
        {
          account_id: accountRow.id,
          user_id: accountRow.user_id,
          access_token_enc: encryptedToken,
        },
        { onConflict: 'account_id' },
      )

    if (tokenError) {
      if (isMissingRelationError(tokenError)) {
        // Legacy schema rollout: token table does not exist yet.
        const { error: legacyUpdateError } = await supabase
          .from('instagram_accounts')
          .update({ access_token_enc: encryptedToken })
          .eq('id', accountRow.id)
          .eq('user_id', accountRow.user_id)

        if (legacyUpdateError) {
          if (isMissingColumnError(legacyUpdateError)) {
            console.error(
              'Token persistence failed: missing token table and missing legacy token column',
            )
            return fail('Step5 (token persistence): no available token storage path')
          }

          console.error('Legacy token fallback update failed:', legacyUpdateError)
          return fail(`Step5 (token fallback): ${legacyUpdateError.message}`)
        }
      } else {
        console.error('Token table upsert error:', tokenError)
        return fail(`Step5 (token upsert): ${tokenError.message}`)
      }
    }

    // Keep a client-safe capability projection in sync with OAuth state.
    // Preserve existing FB-upgrade flags so reconnecting Instagram does not
    // accidentally downgrade Business Discovery capability.
    const nowIso = new Date().toISOString()
    const { data: existingCapabilities, error: capabilitiesReadError } = await supabase
      .from('instagram_account_capabilities')
      .select(
        'facebook_connected,business_discovery_enabled,facebook_token_expires_at,status_reason',
      )
      .eq('account_id', accountRow.id)
      .eq('user_id', accountRow.user_id)
      .maybeSingle()

    if (capabilitiesReadError && !isMissingRelationError(capabilitiesReadError)) {
      console.error('Capability state read failed:', capabilitiesReadError)
      return fail(`Step6 (capability read): ${capabilitiesReadError.message}`)
    }

    if (!capabilitiesReadError || !isMissingRelationError(capabilitiesReadError)) {
      const { error: capabilityUpsertError } = await supabase
        .from('instagram_account_capabilities')
        .upsert(
          {
            account_id: accountRow.id,
            user_id: accountRow.user_id,
            instagram_connected: true,
            facebook_connected: existingCapabilities?.facebook_connected ?? false,
            business_discovery_enabled: existingCapabilities?.business_discovery_enabled ?? false,
            facebook_token_expires_at: existingCapabilities?.facebook_token_expires_at ?? null,
            status_reason: existingCapabilities?.status_reason ?? 'instagram_only',
            last_validated_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'account_id' },
        )

      if (capabilityUpsertError) {
        console.error('Capability state upsert failed:', capabilityUpsertError)
        return fail(`Step6 (capability upsert): ${capabilityUpsertError.message}`)
      }
    } else {
      console.warn('Capability table missing; skipping capability projection update')
    }

    return ok({ success: true, username, instagramUserId })
  } catch (err) {
    console.error('Unexpected error:', err)
    return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  }
})
