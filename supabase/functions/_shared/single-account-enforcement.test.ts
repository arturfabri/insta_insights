import { describe, expect, it } from 'vitest'
import {
  DIFFERENT_ACCOUNT_CONFLICT_MESSAGE,
  resolveSingleAccountLink,
} from './single-account-enforcement'

describe('single-account-enforcement helpers', () => {
  it('allows account creation when the user has no linked account row', () => {
    expect(resolveSingleAccountLink(null, 'ig-user-1')).toEqual({
      kind: 'create_new_account',
    })
  })

  it('reuses the existing row when the provider returns the same Instagram account', () => {
    expect(
      resolveSingleAccountLink(
        {
          id: 'account-1',
          instagram_user_id: 'ig-user-1',
        },
        'ig-user-1',
      ),
    ).toEqual({
      kind: 'reuse_existing_account',
      accountId: 'account-1',
    })
  })

  it('rejects linking a different Instagram account for the same user', () => {
    expect(
      resolveSingleAccountLink(
        {
          id: 'account-1',
          instagram_user_id: 'ig-user-1',
        },
        'ig-user-2',
      ),
    ).toEqual({
      kind: 'different_account_conflict',
      message: DIFFERENT_ACCOUNT_CONFLICT_MESSAGE,
    })
  })
})
