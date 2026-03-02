-- ============================================================
-- Migration: Move encrypted Instagram tokens to private table
-- ============================================================

create table if not exists public.instagram_account_tokens (
  account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_enc text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_instagram_account_tokens_user_id
  on public.instagram_account_tokens(user_id);

alter table public.instagram_account_tokens enable row level security;

-- Defense in depth: block direct table access from browser roles.
revoke all on table public.instagram_account_tokens from anon;
revoke all on table public.instagram_account_tokens from authenticated;

insert into public.instagram_account_tokens (account_id, user_id, access_token_enc)
select id, user_id, access_token_enc
from public.instagram_accounts
where access_token_enc is not null
on conflict (account_id)
do update
set
  user_id = excluded.user_id,
  access_token_enc = excluded.access_token_enc,
  updated_at = now();

alter table public.instagram_accounts
  drop column if exists access_token_enc;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

-- Verify token table exists.
select to_regclass('public.instagram_account_tokens') as token_table;

-- Verify backfill count parity for accounts that now require a token row.
select
  (select count(*) from public.instagram_accounts) as accounts_count,
  (select count(*) from public.instagram_account_tokens) as token_rows_count;

-- Verify old token column is removed from instagram_accounts.
select count(*) as access_token_column_count
from information_schema.columns
where table_schema = 'public'
  and table_name = 'instagram_accounts'
  and column_name = 'access_token_enc';
