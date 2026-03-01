/**
 * Exponential backoff retry utility for Instagram Graph API calls.
 *
 * Contract for callers:
 *   - `fn` should throw the raw `Response` object (not wrapped) when a
 *     non-OK HTTP response is received. This lets withRetry inspect the
 *     status code and Retry-After header on 429 responses.
 *   - For network / parse errors, throw a regular `Error`.
 *
 * Example:
 *   const res = await withRetry(() =>
 *     fetch(url).then((r) => { if (!r.ok) throw r; return r })
 *   )
 */

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exhausted after max retries') {
    super(message)
    this.name = 'RateLimitError'
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Only retry on 429 Too Many Requests — all other errors are fatal
      const is429 = err instanceof Response && err.status === 429
      if (!is429 || attempt === maxRetries) break

      let delayMs = baseDelayMs * Math.pow(2, attempt) // 1s → 2s → 4s

      // Honour the Retry-After header if present
      const retryAfter = (err as Response).headers.get('Retry-After')
      if (retryAfter !== null) {
        const retryAfterSec = parseInt(retryAfter, 10)
        if (!isNaN(retryAfterSec)) delayMs = retryAfterSec * 1000
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  // Surface exhausted 429s as a typed RateLimitError
  if (lastError instanceof Response && lastError.status === 429) {
    throw new RateLimitError()
  }

  throw lastError
}
