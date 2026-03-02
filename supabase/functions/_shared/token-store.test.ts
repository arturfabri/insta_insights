import { describe, expect, it } from 'vitest'
import {
  isMissingColumnError,
  isMissingRelationError,
  isNotNullViolationForColumn,
  readLegacyTokenFromAccountRow,
} from './token-store'

describe('token-store helpers', () => {
  it('detects missing relation errors', () => {
    expect(isMissingRelationError({ code: '42P01', message: 'relation "x" does not exist' })).toBe(true)
    expect(isMissingRelationError({ message: 'relation "public.instagram_account_tokens" does not exist' })).toBe(true)
    expect(isMissingRelationError({ code: 'PGRST116', message: 'JSON object requested, multiple rows returned' })).toBe(false)
  })

  it('detects missing column errors', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column "access_token_enc" does not exist' })).toBe(true)
    expect(isMissingColumnError({ message: 'column public.instagram_accounts.access_token_enc does not exist' })).toBe(true)
    expect(isMissingColumnError({ code: '23502', message: 'null value in column' })).toBe(false)
  })

  it('detects not-null violations for a specific column', () => {
    expect(isNotNullViolationForColumn(
      { code: '23502', details: 'Failing row contains (..., access_token_enc, ...)' },
      'access_token_enc',
    )).toBe(true)
    expect(isNotNullViolationForColumn(
      { code: '23502', message: 'null value in column "another_col" violates not-null constraint' },
      'access_token_enc',
    )).toBe(false)
  })

  it('reads legacy token field from account rows safely', () => {
    expect(readLegacyTokenFromAccountRow({ access_token_enc: 'enc-token' })).toBe('enc-token')
    expect(readLegacyTokenFromAccountRow({ access_token_enc: '' })).toBeNull()
    expect(readLegacyTokenFromAccountRow({})).toBeNull()
    expect(readLegacyTokenFromAccountRow(null)).toBeNull()
  })
})
