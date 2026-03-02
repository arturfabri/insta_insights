import { describe, expect, it } from 'vitest'
import moveTokensSql from '../../supabase/migrations/20260301224501_move_tokens_to_private_table.sql?raw'
import rlsRpcSql from '../../supabase/migrations/20260301224502_harden_accounts_policies_and_add_media_rpc.sql?raw'

describe('security policy contracts', () => {
  it('moves encrypted tokens into dedicated token table and drops account token column', () => {
    expect(moveTokensSql).toContain('create table if not exists public.instagram_account_tokens')
    expect(moveTokensSql).toContain('alter table public.instagram_account_tokens enable row level security;')
    expect(moveTokensSql).toContain('revoke all on table public.instagram_account_tokens from anon;')
    expect(moveTokensSql).toContain('revoke all on table public.instagram_account_tokens from authenticated;')
    expect(moveTokensSql).toContain('drop column if exists access_token_enc;')
  })

  it('removes direct account update policy and hardens media RPC execution grants', () => {
    expect(rlsRpcSql).toContain('drop policy if exists "Users can update their own accounts"')
    expect(rlsRpcSql).toContain('security definer')
    expect(rlsRpcSql).toContain('set search_path = public')
    expect(rlsRpcSql).toContain('revoke execute on function public.list_media_with_insights(text, text, boolean, integer)')
    expect(rlsRpcSql).toContain('grant execute on function public.list_media_with_insights(text, text, boolean, integer)')
  })
})
