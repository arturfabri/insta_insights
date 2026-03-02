interface ProviderErrorPayload {
  error?: {
    message?: string
    code?: number
    type?: string
    error_subcode?: number
  }
}

function stripSecrets(input: string): string {
  return input
    .replace(/access_token=[^&\s]*/gi, 'access_token=[redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
}

export function sanitizeProviderError(status: number, bodyText: string): string {
  const base = `HTTP ${status}`

  try {
    const parsed = JSON.parse(bodyText) as ProviderErrorPayload
    const message = parsed.error?.message?.trim()
    const code = parsed.error?.code

    if (!message) return base

    const safeMessage = stripSecrets(message)
    return code ? `${base} [${code}] ${safeMessage}` : `${base} ${safeMessage}`
  } catch {
    const trimmed = stripSecrets(bodyText).trim().slice(0, 240)
    return trimmed ? `${base} ${trimmed}` : base
  }
}
