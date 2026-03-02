import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/crypto.ts'
import { sanitizeProviderError } from '../_shared/provider-error.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )

    if (authError || !user) return fail('Invalid token')

    const { code, redirectUri, accountId } = await req.json() as {
      code: string
      redirectUri: string
      accountId: string
    }

    if (!code || !redirectUri || !accountId) {
      return fail('Missing code, redirectUri, or accountId')
    }

    const { data: accountRow, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('id, user_id')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (accountError || !accountRow) {
      return fail('Instagram account not found for user')
    }

    const shortTokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    shortTokenUrl.searchParams.set('client_id', META_APP_ID)
    shortTokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    shortTokenUrl.searchParams.set('redirect_uri', redirectUri)
    shortTokenUrl.searchParams.set('code', code)

    const shortTokenRes = await fetch(shortTokenUrl.toString())
    const shortTokenBody = await shortTokenRes.text()
    if (!shortTokenRes.ok) {
      const safeError = sanitizeProviderError(shortTokenRes.status, shortTokenBody)
      return fail(`Facebook OAuth short token exchange failed: ${safeError}`)
    }

    const { access_token: shortLivedToken } = JSON.parse(shortTokenBody) as { access_token: string }
    if (!shortLivedToken) return fail('Facebook OAuth did not return access token')

    const longTokenUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token')
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longTokenUrl.searchParams.set('client_id', META_APP_ID)
    longTokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    longTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    const longTokenRes = await fetch(longTokenUrl.toString())
    const longTokenBody = await longTokenRes.text()
    if (!longTokenRes.ok) {
      const safeError = sanitizeProviderError(longTokenRes.status, longTokenBody)
      return fail(`Facebook OAuth long token exchange failed: ${safeError}`)
    }

    const { access_token: longLivedToken, expires_in } = JSON.parse(longTokenBody) as {
      access_token: string
      expires_in?: number
    }

    if (!longLivedToken) return fail('Facebook OAuth did not return long-lived token')

    const encryptedToken = await encryptToken(longLivedToken, TOKEN_ENCRYPTION_KEY)
    const tokenExpiresAt =
      typeof expires_in === 'number'
        ? new Date(Date.now() + Math.max(0, expires_in - 86400) * 1000).toISOString()
        : null

    const { error: tokenUpsertError } = await supabase
      .from('instagram_account_fb_tokens')
      .upsert(
        {
          account_id: accountRow.id,
          user_id: accountRow.user_id,
          access_token_enc: encryptedToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' },
      )

    if (tokenUpsertError) {
      return fail(`Failed to store Facebook token: ${tokenUpsertError.message}`)
    }

    return ok({ success: true })
  } catch (err) {
    return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  }
})
