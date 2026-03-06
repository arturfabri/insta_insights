-- ============================================================
-- Migration: Repair media insights rows and extend media RPC
-- ============================================================

-- Align insights ownership to the source media owner.
update public.instagram_media_insights i
set user_id = m.user_id
from public.instagram_media m
where i.media_id_fk = m.id
  and i.user_id is distinct from m.user_id;

-- Backfill missing insights rows from the latest media snapshot facts.
with latest_media_metric_facts as (
  select distinct on (f.entity_id, f.metric_name)
    f.entity_id::uuid as media_id_fk,
    f.metric_name,
    f.metric_value_numeric,
    f.fetched_at
  from public.instagram_metric_facts f
  where f.scope = 'media'
    and f.metric_value_numeric is not null
    and f.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  order by f.entity_id, f.metric_name, f.fetched_at desc
),
pivoted_media_metric_facts as (
  select
    l.media_id_fk,
    max(case when l.metric_name = 'reach' then l.metric_value_numeric end) as reach,
    max(case when l.metric_name = 'views' then l.metric_value_numeric end) as views,
    max(case when l.metric_name = 'total_interactions' then l.metric_value_numeric end) as total_interactions,
    max(case when l.metric_name = 'profile_activity' then l.metric_value_numeric end) as profile_activity,
    max(case when l.metric_name = 'replies' then l.metric_value_numeric end) as replies,
    max(case when l.metric_name = 'reposts' then l.metric_value_numeric end) as reposts,
    max(case when l.metric_name = 'reels_skip_rate' then l.metric_value_numeric end) as reels_skip_rate,
    max(case when l.metric_name = 'crossposted_views' then l.metric_value_numeric end) as crossposted_views,
    max(case when l.metric_name = 'facebook_views' then l.metric_value_numeric end) as facebook_views,
    max(case when l.metric_name = 'ig_reels_avg_watch_time' then l.metric_value_numeric end) as ig_reels_avg_watch_time_ms,
    max(case when l.metric_name = 'ig_reels_video_view_total_time' then l.metric_value_numeric end) as ig_reels_video_view_total_time_ms,
    max(case when l.metric_name = 'likes' then l.metric_value_numeric end) as likes,
    max(case when l.metric_name = 'comments' then l.metric_value_numeric end) as comments,
    max(case when l.metric_name = 'shares' then l.metric_value_numeric end) as shares,
    max(case when l.metric_name = 'saved' then l.metric_value_numeric end) as saves,
    max(l.fetched_at) as synced_at
  from latest_media_metric_facts l
  group by l.media_id_fk
),
backfill_candidates as (
  select
    m.id as media_id_fk,
    m.user_id,
    greatest(coalesce(p.reach, 0), 0)::integer as reach,
    case
      when m.is_reel or m.media_type = 'VIDEO' then 0
      else greatest(coalesce(p.views, 0), 0)::integer
    end as impressions,
    case
      when m.is_reel then greatest(coalesce(p.views, 0), 0)::integer
      else null
    end as plays,
    case
      when not m.is_reel and m.media_type = 'VIDEO' then greatest(coalesce(p.views, 0), 0)::integer
      else null
    end as video_views,
    case
      when p.views is null then null
      else greatest(p.views, 0)::integer
    end as views,
    case
      when p.total_interactions is null then null
      else greatest(p.total_interactions, 0)::integer
    end as total_interactions,
    case
      when p.profile_activity is null then null
      else greatest(p.profile_activity, 0)::integer
    end as profile_activity,
    case
      when p.replies is null then null
      else greatest(p.replies, 0)::integer
    end as replies,
    case
      when p.reposts is null then null
      else greatest(p.reposts, 0)::integer
    end as reposts,
    p.reels_skip_rate::numeric as reels_skip_rate,
    case
      when p.crossposted_views is null then null
      else greatest(p.crossposted_views, 0)::integer
    end as crossposted_views,
    case
      when p.facebook_views is null then null
      else greatest(p.facebook_views, 0)::integer
    end as facebook_views,
    case
      when p.ig_reels_avg_watch_time_ms is null then null
      else round(greatest(p.ig_reels_avg_watch_time_ms, 0) / 1000.0, 2)
    end as avg_watch_time_sec,
    case
      when p.ig_reels_video_view_total_time_ms is null then null
      else round(greatest(p.ig_reels_video_view_total_time_ms, 0))::bigint
    end as total_watch_time_ms,
    greatest(coalesce(p.likes, 0), 0)::integer as likes,
    greatest(coalesce(p.comments, 0), 0)::integer as comments,
    greatest(coalesce(p.shares, 0), 0)::integer as shares,
    greatest(coalesce(p.saves, 0), 0)::integer as saves,
    0::integer as profile_visits,
    0::integer as follows,
    case
      when coalesce(p.reach, 0) > 0
        then round(
          (
            greatest(coalesce(p.likes, 0), 0)
            + greatest(coalesce(p.comments, 0), 0)
            + greatest(coalesce(p.shares, 0), 0)
            + greatest(coalesce(p.saves, 0), 0)
          ) / p.reach,
          6
        )
      else null
    end as engagement_rate,
    case
      when p.ig_reels_avg_watch_time_ms is not null
        and m.duration_seconds is not null
        and m.duration_seconds > 0
      then least(
        round((p.ig_reels_avg_watch_time_ms / 1000.0) / m.duration_seconds, 6),
        1
      )
      else null
    end as completion_rate,
    coalesce(p.synced_at, now()) as synced_at
  from public.instagram_media m
  join pivoted_media_metric_facts p
    on p.media_id_fk = m.id
  where not exists (
    select 1
    from public.instagram_media_insights i
    where i.media_id_fk = m.id
  )
)
insert into public.instagram_media_insights (
  media_id_fk,
  user_id,
  reach,
  impressions,
  plays,
  video_views,
  views,
  total_interactions,
  profile_activity,
  replies,
  reposts,
  reels_skip_rate,
  crossposted_views,
  facebook_views,
  completion_rate,
  avg_watch_time_sec,
  total_watch_time_ms,
  likes,
  comments,
  shares,
  saves,
  profile_visits,
  follows,
  engagement_rate,
  synced_at
)
select
  b.media_id_fk,
  b.user_id,
  b.reach,
  b.impressions,
  b.plays,
  b.video_views,
  b.views,
  b.total_interactions,
  b.profile_activity,
  b.replies,
  b.reposts,
  b.reels_skip_rate,
  b.crossposted_views,
  b.facebook_views,
  b.completion_rate,
  b.avg_watch_time_sec,
  b.total_watch_time_ms,
  b.likes,
  b.comments,
  b.shares,
  b.saves,
  b.profile_visits,
  b.follows,
  b.engagement_rate,
  b.synced_at
from backfill_candidates b
on conflict (media_id_fk) do nothing;

-- Return TABLE shape changes require DROP + CREATE (CREATE OR REPLACE cannot
-- change OUT parameter row type for an existing function).
drop function if exists public.list_media_with_insights(text, text, boolean, integer);
drop function if exists public.list_media_with_insights(text, text, boolean, integer, uuid);

create or replace function public.list_media_with_insights(
  p_sort_by text default 'timestamp',
  p_media_type text default null,
  p_is_reel boolean default null,
  p_limit integer default 50,
  p_media_row_id uuid default null
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
  media_product_type text,
  created_at timestamptz,
  updated_at timestamptz,
  insights_id uuid,
  insights_media_id_fk uuid,
  insights_user_id uuid,
  insights_reach integer,
  insights_impressions integer,
  insights_plays integer,
  insights_video_views integer,
  insights_views integer,
  insights_total_interactions integer,
  insights_profile_activity integer,
  insights_replies integer,
  insights_reposts integer,
  insights_reels_skip_rate numeric,
  insights_crossposted_views integer,
  insights_facebook_views integer,
  insights_completion_rate numeric,
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
    m.media_product_type,
    m.created_at,
    m.updated_at,
    i.id,
    i.media_id_fk,
    i.user_id,
    i.reach,
    i.impressions,
    i.plays,
    i.video_views,
    i.views,
    i.total_interactions,
    i.profile_activity,
    i.replies,
    i.reposts,
    i.reels_skip_rate,
    i.crossposted_views,
    i.facebook_views,
    i.completion_rate,
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
    and (p_media_row_id is null or m.id = p_media_row_id)
  order by
    case when v_sort = 'reach' then i.reach end desc nulls last,
    case when v_sort = 'engagement_rate' then i.engagement_rate end desc nulls last,
    m.timestamp desc
  limit v_limit;
end;
$$;

revoke execute on function public.list_media_with_insights(text, text, boolean, integer, uuid) from public;
grant execute on function public.list_media_with_insights(text, text, boolean, integer, uuid) to authenticated;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

-- RLS remains enabled on the protected insights table.
select c.relrowsecurity as instagram_media_insights_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'instagram_media_insights';

-- No insights row should remain attached to a different owner than its media row.
select count(*) as mismatched_insights_owner_count
from public.instagram_media_insights i
join public.instagram_media m on m.id = i.media_id_fk
where i.user_id is distinct from m.user_id;

-- Visibility check for missing insights after backfill.
select count(*) as media_without_insights_count
from public.instagram_media m
left join public.instagram_media_insights i
  on i.media_id_fk = m.id and i.user_id = m.user_id
where i.id is null;

-- RPC exists with detail filter parameter and grants remain scoped.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'list_media_with_insights'
order by p.proname;

select
  has_function_privilege('authenticated', 'public.list_media_with_insights(text,text,boolean,integer,uuid)', 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', 'public.list_media_with_insights(text,text,boolean,integer,uuid)', 'EXECUTE') as anon_can_execute;
