-- ============================================================
-- Migration: Account capability state + sync capability diagnostics
-- ============================================================

create table if not exists public.instagram_account_capabilities (
  account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instagram_connected boolean not null default true,
  facebook_connected boolean not null default false,
  business_discovery_enabled boolean not null default false,
  facebook_token_expires_at timestamptz,
  status_reason text not null default 'instagram_only',
  last_validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_capabilities_fb_gate
    check (facebook_connected or not business_discovery_enabled)
);

create index if not exists idx_instagram_account_capabilities_user_bd
  on public.instagram_account_capabilities(user_id, business_discovery_enabled);

alter table public.instagram_account_capabilities enable row level security;

drop policy if exists "Users can view their own instagram account capabilities"
  on public.instagram_account_capabilities;
create policy "Users can view their own instagram account capabilities"
  on public.instagram_account_capabilities for select
  using (auth.uid() = user_id);

-- Capability table is client-readable only. Updates are managed by edge functions.
revoke all on table public.instagram_account_capabilities from anon;
grant select on table public.instagram_account_capabilities to authenticated;
revoke insert, update, delete on table public.instagram_account_capabilities from authenticated;

-- Keep updated_at deterministic across edge-function writes.
drop trigger if exists trg_instagram_account_capabilities_updated_at
  on public.instagram_account_capabilities;
create trigger trg_instagram_account_capabilities_updated_at
  before update on public.instagram_account_capabilities
  for each row execute function public.handle_updated_at();

alter table public.sync_logs
  add column if not exists capability_gaps jsonb not null default '[]'::jsonb;

-- Backfill capabilities from existing accounts and Facebook-token availability.
insert into public.instagram_account_capabilities (
  account_id,
  user_id,
  instagram_connected,
  facebook_connected,
  business_discovery_enabled,
  facebook_token_expires_at,
  status_reason,
  last_validated_at,
  created_at,
  updated_at
)
select
  a.id as account_id,
  a.user_id,
  true as instagram_connected,
  (
    fbt.access_token_enc is not null
    and (fbt.token_expires_at is null or fbt.token_expires_at > now())
  ) as facebook_connected,
  (
    fbt.access_token_enc is not null
    and (fbt.token_expires_at is null or fbt.token_expires_at > now())
  ) as business_discovery_enabled,
  case
    when (
      fbt.access_token_enc is not null
      and (fbt.token_expires_at is null or fbt.token_expires_at > now())
    ) then fbt.token_expires_at
    else null
  end as facebook_token_expires_at,
  case
    when (
      fbt.access_token_enc is not null
      and (fbt.token_expires_at is null or fbt.token_expires_at > now())
    ) then 'meta_upgraded'
    else 'instagram_only'
  end as status_reason,
  now() as last_validated_at,
  now() as created_at,
  now() as updated_at
from public.instagram_accounts a
left join public.instagram_account_fb_tokens fbt
  on fbt.account_id = a.id
on conflict (account_id)
do update set
  user_id = excluded.user_id,
  instagram_connected = excluded.instagram_connected,
  facebook_connected = excluded.facebook_connected,
  business_discovery_enabled = excluded.business_discovery_enabled,
  facebook_token_expires_at = excluded.facebook_token_expires_at,
  status_reason = excluded.status_reason,
  last_validated_at = excluded.last_validated_at,
  updated_at = now();

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select to_regclass('public.instagram_account_capabilities') as capabilities_table;

select
  c.relrowsecurity as instagram_account_capabilities_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'instagram_account_capabilities';

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'instagram_account_capabilities'
  and indexname = 'idx_instagram_account_capabilities_user_bd';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sync_logs'
  and column_name = 'capability_gaps';

select
  has_table_privilege('authenticated', 'public.instagram_account_capabilities', 'SELECT') as authenticated_can_select_capabilities,
  has_table_privilege('authenticated', 'public.instagram_account_capabilities', 'INSERT') as authenticated_can_insert_capabilities,
  has_table_privilege('authenticated', 'public.instagram_account_capabilities', 'UPDATE') as authenticated_can_update_capabilities,
  has_table_privilege('authenticated', 'public.instagram_account_capabilities', 'DELETE') as authenticated_can_delete_capabilities,
  has_table_privilege('anon', 'public.instagram_account_capabilities', 'SELECT') as anon_can_select_capabilities;
