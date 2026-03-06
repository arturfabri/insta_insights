-- Account-scoped reset for Facebook connection + end-to-end sync retest.
-- Idempotent: safe to run multiple times.
--
-- Target:
--   user_id    = 4d0da5a8-a1c8-4446-9942-398f87295933
--   account_id = 735b3cb9-76c2-4082-8adb-e379ed32e81c
--
-- This script intentionally keeps the instagram_accounts row, while removing
-- account data derived from sync/business discovery and clearing FB capability
-- state to `instagram_only`.

begin;

do $$
declare
  v_user_id uuid := '4d0da5a8-a1c8-4446-9942-398f87295933';
  v_account_id uuid := '735b3cb9-76c2-4082-8adb-e379ed32e81c';
begin
  -- Fail fast if account ownership does not match expected scope.
  if not exists (
    select 1
    from public.instagram_accounts a
    where a.id = v_account_id
      and a.user_id = v_user_id
  ) then
    raise exception
      'Reset preflight failed: account % is missing or not owned by user %',
      v_account_id,
      v_user_id;
  end if;
end
$$;

-- Remove generated/derived datasets tied to this account.
delete from public.content_recommendations
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

delete from public.sync_logs
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

delete from public.instagram_metric_facts
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

delete from public.instagram_account_insights_daily
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

delete from public.instagram_business_discovery_targets
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

-- Deleting media cascades to instagram_media_insights and scoring_results.
delete from public.instagram_media
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

-- Remove Facebook login token for this account.
delete from public.instagram_account_fb_tokens
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

-- Restore capabilities to Instagram-only baseline.
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
values (
  '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid,
  '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid,
  true,
  false,
  false,
  null,
  'instagram_only',
  now(),
  now(),
  now()
)
on conflict (account_id)
do update set
  user_id = excluded.user_id,
  instagram_connected = true,
  facebook_connected = false,
  business_discovery_enabled = false,
  facebook_token_expires_at = null,
  status_reason = 'instagram_only',
  last_validated_at = now(),
  updated_at = now();

-- Reset sync status so the next run behaves like a clean account cycle.
update public.instagram_accounts
set
  last_synced_at = null,
  sync_status = 'pending',
  sync_error = null,
  updated_at = now()
where id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

commit;

-- Verification result set
select
  (select count(*) from public.instagram_accounts a
    where a.id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and a.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as account_rows,
  (select count(*) from public.instagram_business_discovery_targets t
    where t.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and t.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_bd_targets,
  (select count(*) from public.instagram_business_discovery_profiles p
    where p.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and p.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_bd_profiles,
  (select count(*) from public.instagram_business_discovery_daily d
    where d.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and d.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_bd_daily,
  (select count(*) from public.instagram_account_insights_daily i
    where i.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and i.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_account_daily,
  (select count(*) from public.instagram_metric_facts f
    where f.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and f.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_metric_facts,
  (select count(*) from public.instagram_media m
    where m.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and m.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_media,
  (select count(*) from public.content_recommendations c
    where c.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and c.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_recommendations,
  (select count(*) from public.sync_logs s
    where s.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and s.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_sync_logs,
  (select count(*) from public.instagram_account_fb_tokens ft
    where ft.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
      and ft.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid) as remaining_fb_tokens;

select
  c.account_id,
  c.user_id,
  c.instagram_connected,
  c.facebook_connected,
  c.business_discovery_enabled,
  c.facebook_token_expires_at,
  c.status_reason,
  c.last_validated_at,
  c.updated_at
from public.instagram_account_capabilities c
where c.account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and c.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

select
  a.id,
  a.user_id,
  a.sync_status,
  a.last_synced_at,
  a.sync_error,
  a.updated_at
from public.instagram_accounts a
where a.id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and a.user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

/*
Optional hard reset (use only if you want to reconnect Instagram too):

begin;

delete from public.instagram_account_tokens
where account_id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

delete from public.instagram_accounts
where id = '735b3cb9-76c2-4082-8adb-e379ed32e81c'::uuid
  and user_id = '4d0da5a8-a1c8-4446-9942-398f87295933'::uuid;

commit;
*/
