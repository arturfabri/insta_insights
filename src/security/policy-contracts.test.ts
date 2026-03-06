import { describe, expect, it } from 'vitest'
import moveTokensSql from '../../supabase/migrations/20260301224501_move_tokens_to_private_table.sql?raw'
import rlsRpcSql from '../../supabase/migrations/20260301224502_harden_accounts_policies_and_add_media_rpc.sql?raw'
import metricFactsSql from '../../supabase/migrations/20260302183500_add_metric_facts_and_sync_log_metric_tracking.sql?raw'
import expansionSql from '../../supabase/migrations/20260302185500_expand_metrics_schema_business_discovery_and_rpcs.sql?raw'
import capabilitiesSql from '../../supabase/migrations/20260302221500_add_account_capabilities_and_sync_capability_gaps.sql?raw'
import repairSignalsSql from '../../supabase/migrations/20260306005000_repair_media_insights_and_extend_media_rpc.sql?raw'
import providerErrorsSql from '../../supabase/migrations/20260306105200_add_sync_log_provider_error_fields.sql?raw'
import singleAccountSql from '../../supabase/migrations/20260306153000_enforce_single_instagram_account_per_user.sql?raw'

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

  it('creates capability projection with read-only client access and sync capability diagnostics', () => {
    expect(capabilitiesSql).toContain('create table if not exists public.instagram_account_capabilities')
    expect(capabilitiesSql).toContain('check (facebook_connected or not business_discovery_enabled)')
    expect(capabilitiesSql).toContain('grant select on table public.instagram_account_capabilities to authenticated;')
    expect(capabilitiesSql).toContain('revoke insert, update, delete on table public.instagram_account_capabilities from authenticated;')
    expect(capabilitiesSql).toContain('add column if not exists capability_gaps jsonb not null default')
  })

  it('repairs missing insights and extends media RPC with row-level detail filter', () => {
    expect(repairSignalsSql).toContain('update public.instagram_media_insights i')
    expect(repairSignalsSql).toContain('insert into public.instagram_media_insights')
    expect(repairSignalsSql).toContain('p_media_row_id uuid default null')
    expect(repairSignalsSql).toContain('and (p_media_row_id is null or m.id = p_media_row_id)')
    expect(repairSignalsSql).toContain('security definer')
    expect(repairSignalsSql).toContain('set search_path = public')
    expect(repairSignalsSql).toContain('revoke execute on function public.list_media_with_insights(text, text, boolean, integer, uuid) from public;')
    expect(repairSignalsSql).toContain('grant execute on function public.list_media_with_insights(text, text, boolean, integer, uuid) to authenticated;')
    expect(repairSignalsSql).toContain('mismatched_insights_owner_count')
    expect(repairSignalsSql).toContain('media_without_insights_count')
  })

  it('adds provider error diagnostics columns to sync logs', () => {
    expect(providerErrorsSql).toContain('alter table public.sync_logs')
    expect(providerErrorsSql).toContain('add column if not exists provider_error_text text')
    expect(providerErrorsSql).toContain("add column if not exists provider_error_details jsonb not null default '{}'::jsonb")
    expect(providerErrorsSql).toContain("column_name in ('provider_error_text', 'provider_error_details')")
  })

  it('enforces one instagram account per user with duplicate preflight', () => {
    expect(singleAccountSql).toContain('Duplicate instagram_accounts rows exist for user_id(s)')
    expect(singleAccountSql).toContain('create unique index if not exists uq_instagram_accounts_user_id')
    expect(singleAccountSql).toContain('on public.instagram_accounts (user_id)')
    expect(singleAccountSql).toContain('Verification failed: duplicate instagram_accounts rows still exist per user_id.')
  })
})
