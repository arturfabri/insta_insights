-- ============================================================
-- Migration 003: Add 'partial' to instagram_accounts.sync_status
--                + enable Realtime REPLICA IDENTITY FULL
-- ============================================================

-- Safely drop the old CHECK constraint by finding its name at runtime
-- (avoids hardcoding the auto-generated name)
do $$
declare
  _name text;
begin
  select conname into _name
  from   pg_constraint
  where  conrelid = 'public.instagram_accounts'::regclass
    and  contype  = 'c'
    and  pg_get_constraintdef(oid) like '%sync_status%';

  if _name is not null then
    execute format('alter table public.instagram_accounts drop constraint %I', _name);
  end if;
end $$;

-- Re-add with 'partial' included
alter table public.instagram_accounts
  add constraint instagram_accounts_sync_status_check
  check (sync_status in ('pending', 'syncing', 'complete', 'error', 'partial'));

-- Enable Realtime for live sync status updates in the useSyncStatus hook.
-- REPLICA IDENTITY FULL ensures the old/new row values are included in
-- Postgres change events so Supabase Realtime can filter by user_id.
alter table public.instagram_accounts replica identity full;
