export interface ExistingInstagramAccountLink {
  id: string
  instagram_user_id: string
}

export type SingleAccountLinkResolution =
  | { kind: 'create_new_account' }
  | { kind: 'reuse_existing_account'; accountId: string }
  | { kind: 'requested_account_mismatch'; message: string }
  | { kind: 'different_account_conflict'; message: string }

export const DIFFERENT_ACCOUNT_CONFLICT_MESSAGE =
  'A different Instagram account is already linked to this user. Reconnect the existing account instead of linking another one.'

export const REQUESTED_ACCOUNT_MISMATCH_MESSAGE =
  'OAuth returned a different Instagram account than the requested record.'

/**
 * Resolves the one-account-per-user invariant for OAuth flows before any write.
 * The caller still performs the actual DB update/insert; this only decides
 * whether the provider identity may reuse the existing user account row.
 */
export function resolveSingleAccountLink(
  existingAccount: ExistingInstagramAccountLink | null,
  instagramUserId: string,
): SingleAccountLinkResolution {
  if (!existingAccount) {
    return { kind: 'create_new_account' }
  }

  if (existingAccount.instagram_user_id === instagramUserId) {
    return { kind: 'reuse_existing_account', accountId: existingAccount.id }
  }

  return {
    kind: 'different_account_conflict',
    message: DIFFERENT_ACCOUNT_CONFLICT_MESSAGE,
  }
}
