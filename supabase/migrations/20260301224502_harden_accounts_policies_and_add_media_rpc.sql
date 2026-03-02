-- ============================================================
-- Migration: Harden account updates and add deterministic media RPC
-- ============================================================

drop policy if exists "Users can update their own accounts"
  on public.instagram_accounts;

create index if not exists idx_instagram_media_user_type_reel_timestamp
  on public.instagram_media(user_id, media_type, is_reel, timestamp desc);

create index if not exists idx_instagram_media_insights_user_reach
  on public.instagram_media_insights(user_id, reach desc);

create index if not exists idx_instagram_media_insights_user_engagement_rate
  on public.instagram_media_insights(user_id, engagement_rate desc);

create index if not exists idx_instagram_media_insights_media_id_fk
  on public.instagram_media_insights(media_id_fk);

create or replace function public.list_media_with_insights(
  p_sort_by text default 'timestamp',
  p_media_type text default null,
  p_is_reel boolean default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  account_id uuid,
  user_id uuid,
  media_id text,
  media_type text,
  is_reel boolean,
  caption text,
  permalink text,
  thumbnail_url text,
  media_url text,
  "timestamp" timestamptz,
  duration_seconds numeric,
  created_at timestamptz,
  updated_at timestamptz,
  insights_id uuid,
  insights_media_id_fk uuid,
  insights_user_id uuid,
  insights_reach integer,
  insights_impressions integer,
  insights_plays integer,
  insights_video_views integer,
  insights_avg_watch_time_sec numeric,
  insights_total_watch_time_ms bigint,
  insights_likes integer,
  insights_comments integer,
  insights_shares integer,
  insights_saves integer,
  insights_profile_visits integer,
  insights_follows integer,
  insights_engagement_rate numeric,
  insights_synced_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sort text := coalesce(p_sort_by, 'timestamp');
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if v_sort not in ('timestamp', 'reach', 'engagement_rate') then
    raise exception 'Invalid sort parameter: %', v_sort;
  end if;

  return query
  select
    m.id,
    m.account_id,
    m.user_id,
    m.media_id,
    m.media_type,
    m.is_reel,
    m.caption,
    m.permalink,
    m.thumbnail_url,
    m.media_url,
    m.timestamp,
    m.duration_seconds,
    m.created_at,
    m.updated_at,
    i.id,
    i.media_id_fk,
    i.user_id,
    i.reach,
    i.impressions,
    i.plays,
    i.video_views,
    i.avg_watch_time_sec,
    i.total_watch_time_ms,
    i.likes,
    i.comments,
    i.shares,
    i.saves,
    i.profile_visits,
    i.follows,
    i.engagement_rate,
    i.synced_at
  from public.instagram_media m
  left join public.instagram_media_insights i
    on i.media_id_fk = m.id and i.user_id = m.user_id
  where m.user_id = v_user_id
    and (p_media_type is null or m.media_type = p_media_type)
    and (p_is_reel is null or m.is_reel = p_is_reel)
  order by
    case when v_sort = 'reach' then i.reach end desc nulls last,
    case when v_sort = 'engagement_rate' then i.engagement_rate end desc nulls last,
    m.timestamp desc
  limit v_limit;
end;
$$;

revoke execute on function public.list_media_with_insights(text, text, boolean, integer)
  from public;
grant execute on function public.list_media_with_insights(text, text, boolean, integer)
  to authenticated;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

-- RLS still enabled on core account table.
select c.relrowsecurity as instagram_accounts_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'instagram_accounts';

-- Update policy removed from instagram_accounts.
select count(*) as account_update_policy_count
from pg_policies
where schemaname = 'public'
  and tablename = 'instagram_accounts'
  and policyname = 'Users can update their own accounts';

-- Function exists and execute grants are scoped correctly.
select
  has_function_privilege('authenticated', 'public.list_media_with_insights(text,text,boolean,integer)', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', 'public.list_media_with_insights(text,text,boolean,integer)', 'EXECUTE') as anon_can_execute;

-- Index presence sanity check.
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_instagram_media_user_type_reel_timestamp',
    'idx_instagram_media_insights_user_reach',
    'idx_instagram_media_insights_user_engagement_rate',
    'idx_instagram_media_insights_media_id_fk'
  )
order by indexname;
