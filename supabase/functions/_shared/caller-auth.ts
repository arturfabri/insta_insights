interface SupabaseAuthClient {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null }
      error: unknown
    }>
  }
}

export type CallerContext =
  | { kind: 'user'; userId: string }
  | { kind: 'cron' }

export type CallerAuthResult =
  | { success: true; caller: CallerContext }
  | { success: false; error: 'Unauthorized' }

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export async function resolveCallerAuth(
  req: Request,
  supabase: SupabaseAuthClient,
  cronSecret: string | null,
): Promise<CallerAuthResult> {
  const bearer = getBearerToken(req.headers.get('Authorization'))
  if (bearer) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer)

    if (!error && user) {
      return { success: true, caller: { kind: 'user', userId: user.id } }
    }
  }

  const cronHeader = req.headers.get('X-Cron-Secret')
  if (cronSecret && cronHeader && cronHeader === cronSecret) {
    return { success: true, caller: { kind: 'cron' } }
  }

  return { success: false, error: 'Unauthorized' }
}
