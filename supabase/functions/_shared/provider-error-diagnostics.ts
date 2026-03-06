export interface ProviderErrorDiagnosticsInput {
  media: string | null
  account: string | null
  businessDiscovery: string | null
}

export interface ProviderErrorDiagnostics {
  providerErrorText: string | null
  providerErrorDetails: Record<string, string>
}

function normalizedError(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Builds a compact sync-log diagnostic payload for provider/API-level failures.
 * We keep one "first error" text for quick filtering and a per-domain map for drill-down.
 */
export function buildProviderErrorDiagnostics(
  input: ProviderErrorDiagnosticsInput,
): ProviderErrorDiagnostics {
  const media = normalizedError(input.media)
  const account = normalizedError(input.account)
  const businessDiscovery = normalizedError(input.businessDiscovery)

  const providerErrorDetails: Record<string, string> = {}
  if (media) providerErrorDetails.media = media
  if (account) providerErrorDetails.account = account
  if (businessDiscovery) providerErrorDetails.business_discovery = businessDiscovery

  return {
    providerErrorText: media ?? account ?? businessDiscovery ?? null,
    providerErrorDetails,
  }
}
