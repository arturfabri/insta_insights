import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { encryptToken } from '../_shared/crypto.ts'

const META_APP_ID = Deno.env.get('META_APP_ID')!
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!
const TOKEN_ENCRYPTION_KEY = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify authenticated user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create admin client to verify user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { code, redirectUri } = await req.json() as { code: string; redirectUri: string }

    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirectUri' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    if (!shortLivedRes.ok) {
      const err = await shortLivedRes.text()
      console.error('Short-lived token error:', err)
      return new Response(JSON.stringify({ error: 'Failed to exchange code for token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { access_token: shortLivedToken } = await shortLivedRes.json() as { access_token: string }

    // Step 2: Exchange for long-lived token (valid 60 days)
    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
    longLivedUrl.searchParams.set('access_token', shortLivedToken)

    const longLivedRes = await fetch(longLivedUrl.toString())

    if (!longLivedRes.ok) {
      const err = await longLivedRes.text()
      console.error('Long-lived token error:', err)
      return new Response(JSON.stringify({ error: 'Failed to exchange for long-lived token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { access_token: longLivedToken, expires_in } = await longLivedRes.json() as {
      access_token: string
      expires_in: number
    }

    // Step 3: Fetch Instagram user info
    const meUrl = new URL('https://graph.instagram.com/me')
    meUrl.searchParams.set('fields', 'id,username')
    meUrl.searchParams.set('access_token', longLivedToken)

    const meRes = await fetch(meUrl.toString())

    if (!meRes.ok) {
      const err = await meRes.text()
      console.error('User info error:', err)
      return new Response(JSON.stringify({ error: 'Failed to fetch Instagram user info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { id: instagramUserId, username } = await meRes.json() as {
      id: string
      username: string
    }

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
      return new Response(JSON.stringify({ error: 'Failed to save account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, username, instagramUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
