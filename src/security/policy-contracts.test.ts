import { describe, expect, it } from 'vitest'
import moveTokensSql from '../../supabase/migrations/20260301224501_move_tokens_to_private_table.sql?raw'
import rlsRpcSql from '../../supabase/migrations/20260301224502_harden_accounts_policies_and_add_media_rpc.sql?raw'
import metricFactsSql from '../../supabase/migrations/20260302183500_add_metric_facts_and_sync_log_metric_tracking.sql?raw'
import expansionSql from '../../supabase/migrations/20260302185500_expand_metrics_schema_business_discovery_and_rpcs.sql?raw'

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

  it('creates daily-grain metric facts identity and sync-log metric tracking fields', () => {
    expect(metricFactsSql).toContain('create table if not exists public.instagram_metric_facts')
    expect(metricFactsSql).toContain('metric_date date not null')
    expect(metricFactsSql).toContain('create unique index if not exists uq_instagram_metric_facts_identity')
    expect(metricFactsSql).toContain('add column if not exists metrics_attempted jsonb not null default')
    expect(metricFactsSql).toContain('add column if not exists metrics_succeeded jsonb not null default')
    expect(metricFactsSql).toContain('add column if not exists metrics_failed jsonb not null default')
  })

  it('creates account/business-discovery projection tables and secured trend RPCs', () => {
    expect(expansionSql).toContain('create table if not exists public.instagram_account_insights_daily')
    expect(expansionSql).toContain('create table if not exists public.instagram_business_discovery_targets')
    expect(expansionSql).toContain('create table if not exists public.instagram_business_discovery_profiles')
    expect(expansionSql).toContain('create table if not exists public.instagram_business_discovery_daily')
    expect(expansionSql).toContain('create table if not exists public.instagram_account_fb_tokens')
    expect(expansionSql).toContain('create or replace function public.list_account_insights_timeseries')
    expect(expansionSql).toContain('create or replace function public.list_business_discovery_trends')
    expect(expansionSql).toContain("add column if not exists views integer")
  })
})
