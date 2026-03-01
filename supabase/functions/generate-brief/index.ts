/**
 * generate-brief — calls Claude to produce structured content briefs.
 *
 * Rate limit: 10 generations per user per day (checked via content_recommendations).
 * Always returns HTTP 200 with { success, briefs?, error? }.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY        = Deno.env.get('ANTHROPIC_API_KEY')!

const MODEL          = 'claude-haiku-4-5-20251001'
const MAX_PER_DAY    = 10
const VALID_COUNTS   = [5, 10, 20] as const
type BriefCount = (typeof VALID_COUNTS)[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('Missing authorization header')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) return fail('Invalid token')

    // ── Body ─────────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({})) as {
      goal?: string
      count?: number
      patternSummary?: string
      topPostSummaries?: string[]
      accountId?: string
    }

    const { goal, patternSummary, topPostSummaries = [], accountId } = body
    if (!goal || (goal !== 'growth' && goal !== 'leads')) {
      return fail('goal must be "growth" or "leads"')
    }
    const count: BriefCount = VALID_COUNTS.includes(body.count as BriefCount)
      ? (body.count as BriefCount)
      : 5

    // ── Rate limit ────────────────────────────────────────────────────────────
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)

    const { count: usedToday, error: countError } = await supabase
      .from('content_recommendations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('generated_at', todayUtc.toISOString())

    if (countError) {
      console.error('Rate-limit query error:', countError)
    } else if ((usedToday ?? 0) >= MAX_PER_DAY) {
      return fail(`Daily limit reached (${MAX_PER_DAY} generations per day). Try again tomorrow.`)
    }

    // ── Build prompt ──────────────────────────────────────────────────────────
    const goalDescription = goal === 'growth'
      ? 'growing the account (reach, shares, follows, Reel retention)'
      : 'generating leads and sales (saves, profile visits, CTAs, DMs)'

    const topPostsBlock = topPostSummaries.length > 0
      ? `\n\nTop performing posts:\n${topPostSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : ''

    const systemPrompt = `You are an expert Instagram content strategist.
Your task is to generate content briefs based on a creator's real performance data.
Always respond with valid JSON only — no markdown fences, no preamble.`

    const userPrompt = `Goal: ${goalDescription}

Pattern analysis: ${patternSummary ?? 'No pattern data available.'}${topPostsBlock}

Generate exactly ${count} content briefs as a JSON array.
Each brief must have these exact fields:
{
  "title": "Brief title (creative, action-oriented)",
  "format": "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
  "hook": "Opening line for the caption (attention-grabbing)",
  "structure": "How to structure the content (e.g. '7-slide carousel: slide 1 = ...', 'Reel: hook → problem → solution → CTA')",
  "captionDraft": "Full draft caption with line breaks and hashtags",
  "cta": "Specific call to action",
  "rationale": "1-2 sentences explaining why this brief is likely to perform well"
}

Respond with ONLY the JSON array, nothing else.`

    // ── Call Anthropic API ────────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error:', errText)
      return fail(`AI generation failed: ${anthropicRes.status}`)
    }

    const anthropicBody = await anthropicRes.json() as {
      content: Array<{ type: string; text: string }>
    }

    const rawText = anthropicBody.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('')

    let briefs: unknown[]
    try {
      briefs = JSON.parse(rawText) as unknown[]
      if (!Array.isArray(briefs)) throw new Error('Response is not an array')
    } catch {
      console.error('Failed to parse Claude response:', rawText.slice(0, 500))
      return fail('AI returned an unexpected format. Please try again.')
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const { error: insertError } = await supabase
      .from('content_recommendations')
      .insert({
        user_id:        user.id,
        account_id:     accountId ?? null,
        goal,
        request_params: {
          count,
          topPostIds:   [],
          formatMix:    {},
        },
        briefs,
        generated_at:   new Date().toISOString(),
        exported_formats: [],
      })

    if (insertError) {
      console.error('DB insert error:', insertError)
      // Non-fatal — still return the briefs to the client
    }

    return ok({ success: true, briefs })
  } catch (err) {
    console.error('Unhandled error:', err)
    return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  }
})
