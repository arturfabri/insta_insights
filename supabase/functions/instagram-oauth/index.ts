import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/crypto.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const { code, redirectUri } = await req.json() as { code: string; redirectUri: string }

    if (!code || !redirectUri) return fail('Missing code or redirectUri')

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
    console.log('Step1 status:', shortLivedRes.status, 'body:', shortLivedBody)

    if (!shortLivedRes.ok) {
      return fail(`Step1 (code→short token): ${shortLivedBody}`)
    }

    const { access_token: shortLivedToken } = JSON.parse(shortLivedBody) as { access_token: string }

    // Step 2: Exchange for long-lived token (valid 60 days)
    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
    longLivedUrl.searchParams.set('access_token', shortLivedToken)

    const longLivedRes = await fetch(longLivedUrl.toString())
    const longLivedBody = await longLivedRes.text()
    console.log('Step2 status:', longLivedRes.status, 'body:', longLivedBody)

    if (!longLivedRes.ok) {
      return fail(`Step2 (short→long token): ${longLivedBody}`)
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
    console.log('Step3 status:', meRes.status, 'body:', meBody)

    if (!meRes.ok) {
      return fail(`Step3 (/me): ${meBody}`)
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

    // Step 5: Upsert into instagram_accounts
    const { error: upsertError } = await supabase
      .from('instagram_accounts')
      .upsert(
        {
          user_id: user.id,
          instagram_user_id: instagramUserId,
          username,
          access_token_enc: encryptedToken,
          token_expires_at: tokenExpiresAt,
          sync_status: 'pending',
          sync_error: null,
        },
        { onConflict: 'user_id,instagram_user_id' }
      )

    if (upsertError) {
      console.error('DB upsert error:', upsertError)
      return fail(`Step5 (DB upsert): ${upsertError.message}`)
    }

    return ok({ success: true, username, instagramUserId })
  } catch (err) {
    console.error('Unexpected error:', err)
    return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  }
})
