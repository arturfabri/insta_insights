interface DbErrorLike {
  code?: string | null
  message?: string | null
  details?: string | null
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function includesNormalized(haystack: string | null | undefined, needle: string): boolean {
  return hasText(haystack) && haystack.toLowerCase().includes(needle)
}

export function isMissingRelationError(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01') return true

  return includesNormalized(error.message, 'relation') &&
    includesNormalized(error.message, 'does not exist')
}

export function isMissingColumnError(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42703') return true

  return includesNormalized(error.message, 'column') &&
    includesNormalized(error.message, 'does not exist')
}

export function isNotNullViolationForColumn(
  error: DbErrorLike | null | undefined,
  columnName: string,
): boolean {
  if (!error) return false
  if (error.code !== '23502') return false

  const column = columnName.toLowerCase()
  return includesNormalized(error.details, column) || includesNormalized(error.message, column)
}

/** Read the legacy encrypted token from a `instagram_accounts` row if present. */
export function readLegacyTokenFromAccountRow(accountRow: unknown): string | null {
  if (!accountRow || typeof accountRow !== 'object') return null

  const token = (accountRow as { access_token_enc?: unknown }).access_token_enc
  return hasText(token) ? token : null
}
