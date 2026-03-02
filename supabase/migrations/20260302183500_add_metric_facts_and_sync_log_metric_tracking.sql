-- ============================================================
-- Migration: Add instagram metric facts + sync log metric tracking
-- ============================================================

create table if not exists public.instagram_metric_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  scope text not null
    check (scope in ('media', 'account', 'business_discovery_account', 'business_discovery_media')),
  entity_id text not null,
  metric_name text not null,
  metric_value_numeric numeric,
  metric_value_jsonb jsonb,
  period text not null default '',
  metric_type text not null default '',
  timeframe text not null default '',
  breakdown_type text not null default '',
  breakdown_value text not null default '',
  metric_date date not null,
  fetched_at timestamptz not null default now()
);

alter table public.instagram_metric_facts enable row level security;

create policy "Users can view their own metric facts"
  on public.instagram_metric_facts for select
  using (auth.uid() = user_id);

-- Deterministic uniqueness for daily-grain facts.
create unique index if not exists uq_instagram_metric_facts_identity
  on public.instagram_metric_facts (
    user_id,
    account_id,
    scope,
    entity_id,
    metric_name,
    metric_date,
    period,
    metric_type,
    timeframe,
    breakdown_type,
    breakdown_value
  );

create index if not exists idx_instagram_metric_facts_user_scope_metric_date
  on public.instagram_metric_facts(user_id, scope, metric_name, metric_date desc);

create index if not exists idx_instagram_metric_facts_account_scope_metric_date
  on public.instagram_metric_facts(account_id, scope, metric_name, metric_date desc);

alter table public.sync_logs
  add column if not exists metrics_requested_count integer not null default 0,
  add column if not exists metrics_succeeded_count integer not null default 0,
  add column if not exists metrics_failed_count integer not null default 0,
  add column if not exists metrics_attempted jsonb not null default '[]'::jsonb,
  add column if not exists metrics_succeeded jsonb not null default '[]'::jsonb,
  add column if not exists metrics_failed jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select to_regclass('public.instagram_metric_facts') as metric_facts_table;

select
  c.relrowsecurity as instagram_metric_facts_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'instagram_metric_facts';

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'uq_instagram_metric_facts_identity',
    'idx_instagram_metric_facts_user_scope_metric_date',
    'idx_instagram_metric_facts_account_scope_metric_date'
  )
order by indexname;

select
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sync_logs'
  and column_name in (
    'metrics_requested_count',
    'metrics_succeeded_count',
    'metrics_failed_count',
    'metrics_attempted',
    'metrics_succeeded',
    'metrics_failed'
  )
order by column_name;
