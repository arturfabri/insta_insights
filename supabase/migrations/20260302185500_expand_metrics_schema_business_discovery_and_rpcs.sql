-- ============================================================
-- Migration: Expand metrics schema, business discovery model, and RPCs
-- ============================================================

create table if not exists public.instagram_account_fb_tokens (
  account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token_enc text not null,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instagram_account_fb_tokens_user_id
  on public.instagram_account_fb_tokens(user_id);

alter table public.instagram_account_fb_tokens enable row level security;
revoke all on table public.instagram_account_fb_tokens from anon;
revoke all on table public.instagram_account_fb_tokens from authenticated;

create table if not exists public.instagram_account_insights_daily (
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  metric_type text not null default '',
  timeframe text not null default '',
  accounts_engaged integer,
  reach integer,
  views integer,
  total_interactions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  reposts integer,
  profile_links_taps integer,
  follows integer,
  unfollows integer,
  net_follower_growth integer,
  updated_at timestamptz not null default now(),
  primary key (account_id, metric_date, metric_type, timeframe)
);

create index if not exists idx_account_insights_daily_account_date
  on public.instagram_account_insights_daily(account_id, metric_date desc);

alter table public.instagram_account_insights_daily enable row level security;

create policy "Users can view their own account insights daily"
  on public.instagram_account_insights_daily for select
  using (auth.uid() = user_id);

create table if not exists public.instagram_business_discovery_targets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_username text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, target_username)
);

create index if not exists idx_business_discovery_targets_account_active
  on public.instagram_business_discovery_targets(account_id, is_active);

alter table public.instagram_business_discovery_targets enable row level security;

create policy "Users can view their own business discovery targets"
  on public.instagram_business_discovery_targets for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business discovery targets"
  on public.instagram_business_discovery_targets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business discovery targets"
  on public.instagram_business_discovery_targets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own business discovery targets"
  on public.instagram_business_discovery_targets for delete
  using (auth.uid() = user_id);

create table if not exists public.instagram_business_discovery_profiles (
  target_id uuid primary key references public.instagram_business_discovery_targets(id) on delete cascade,
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ig_user_id text,
  username text,
  name text,
  profile_picture_url text,
  followers_count integer,
  follows_count integer,
  media_count integer,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_discovery_profiles_account
  on public.instagram_business_discovery_profiles(account_id);

alter table public.instagram_business_discovery_profiles enable row level security;

create policy "Users can view their own business discovery profiles"
  on public.instagram_business_discovery_profiles for select
  using (auth.uid() = user_id);

create table if not exists public.instagram_business_discovery_daily (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.instagram_business_discovery_targets(id) on delete cascade,
  account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  followers_count integer,
  follows_count integer,
  media_count integer,
  profile_views integer,
  website_taps integer,
  captured_at timestamptz not null default now(),
  unique (target_id, snapshot_date)
);

create index if not exists idx_business_discovery_daily_target_date
  on public.instagram_business_discovery_daily(target_id, snapshot_date desc);

alter table public.instagram_business_discovery_daily enable row level security;

create policy "Users can view their own business discovery daily"
  on public.instagram_business_discovery_daily for select
  using (auth.uid() = user_id);

alter table public.instagram_media
  add column if not exists media_product_type text;

alter table public.instagram_media_insights
  add column if not exists views integer,
  add column if not exists total_interactions integer,
  add column if not exists profile_activity integer,
  add column if not exists replies integer,
  add column if not exists reposts integer,
  add column if not exists reels_skip_rate numeric(8,6),
  add column if not exists crossposted_views integer,
  add column if not exists facebook_views integer,
  add column if not exists completion_rate numeric(8,6);

alter table public.sync_logs
  add column if not exists scope text not null default 'all'
    check (scope in ('media', 'account', 'business_discovery', 'all')),
  add column if not exists api_host text,
  add column if not exists api_version text,
  add column if not exists rate_limit_events integer not null default 0,
  add column if not exists failure_class text;

-- Return TABLE shape changes require DROP + CREATE (CREATE OR REPLACE cannot
-- change OUT parameter row type for an existing function).
drop function if exists public.list_media_with_insights(text, text, boolean, integer);

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
  order by
    case when v_sort = 'reach' then i.reach end desc nulls last,
    case when v_sort = 'engagement_rate' then i.engagement_rate end desc nulls last,
    m.timestamp desc
  limit v_limit;
end;
$$;

revoke execute on function public.list_media_with_insights(text, text, boolean, integer) from public;
grant execute on function public.list_media_with_insights(text, text, boolean, integer) to authenticated;

create or replace function public.list_account_insights_timeseries(
  p_account_id uuid,
  p_metrics text[] default null,
  p_date_from date default null,
  p_date_to date default null,
  p_breakdown_type text default null
)
returns table (
  metric_date date,
  metric_name text,
  value numeric,
  breakdown_type text,
  breakdown_value text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.instagram_accounts a
    where a.id = p_account_id
      and a.user_id = v_user_id
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    f.metric_date,
    f.metric_name,
    f.metric_value_numeric as value,
    nullif(f.breakdown_type, ''),
    nullif(f.breakdown_value, '')
  from public.instagram_metric_facts f
  where f.user_id = v_user_id
    and f.account_id = p_account_id
    and f.scope = 'account'
    and f.metric_value_numeric is not null
    and (p_metrics is null or cardinality(p_metrics) = 0 or f.metric_name = any(p_metrics))
    and (p_date_from is null or f.metric_date >= p_date_from)
    and (p_date_to is null or f.metric_date <= p_date_to)
    and (p_breakdown_type is null or f.breakdown_type = p_breakdown_type)
  order by f.metric_date desc, f.metric_name asc;
end;
$$;

revoke execute on function public.list_account_insights_timeseries(uuid, text[], date, date, text) from public;
grant execute on function public.list_account_insights_timeseries(uuid, text[], date, date, text) to authenticated;

create or replace function public.list_business_discovery_trends(
  p_account_id uuid,
  p_target_id uuid,
  p_metrics text[] default null,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  metric_date date,
  metric_name text,
  value numeric,
  target_username text,
  breakdown_type text,
  breakdown_value text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.instagram_business_discovery_targets t
    where t.id = p_target_id
      and t.account_id = p_account_id
      and t.user_id = v_user_id
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    f.metric_date,
    f.metric_name,
    f.metric_value_numeric as value,
    t.target_username,
    nullif(f.breakdown_type, ''),
    nullif(f.breakdown_value, '')
  from public.instagram_metric_facts f
  join public.instagram_business_discovery_targets t
    on t.id::text = f.entity_id
  where f.user_id = v_user_id
    and f.account_id = p_account_id
    and f.scope = 'business_discovery_account'
    and t.id = p_target_id
    and f.metric_value_numeric is not null
    and (p_metrics is null or cardinality(p_metrics) = 0 or f.metric_name = any(p_metrics))
    and (p_date_from is null or f.metric_date >= p_date_from)
    and (p_date_to is null or f.metric_date <= p_date_to)
  order by f.metric_date desc, f.metric_name asc;
end;
$$;

revoke execute on function public.list_business_discovery_trends(uuid, uuid, text[], date, date) from public;
grant execute on function public.list_business_discovery_trends(uuid, uuid, text[], date, date) to authenticated;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select to_regclass('public.instagram_account_insights_daily') as account_insights_daily_table;
select to_regclass('public.instagram_business_discovery_targets') as business_discovery_targets_table;
select to_regclass('public.instagram_business_discovery_profiles') as business_discovery_profiles_table;
select to_regclass('public.instagram_business_discovery_daily') as business_discovery_daily_table;
select to_regclass('public.instagram_account_fb_tokens') as fb_tokens_table;

select
  has_function_privilege('authenticated', 'public.list_account_insights_timeseries(uuid,text[],date,date,text)', 'EXECUTE') as account_ts_authenticated_can_execute,
  has_function_privilege('anon', 'public.list_account_insights_timeseries(uuid,text[],date,date,text)', 'EXECUTE') as account_ts_anon_can_execute,
  has_function_privilege('authenticated', 'public.list_business_discovery_trends(uuid,uuid,text[],date,date)', 'EXECUTE') as bd_trends_authenticated_can_execute,
  has_function_privilege('anon', 'public.list_business_discovery_trends(uuid,uuid,text[],date,date)', 'EXECUTE') as bd_trends_anon_can_execute;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'instagram_media_insights'
  and column_name in (
    'views',
    'total_interactions',
    'profile_activity',
    'replies',
    'reposts',
    'reels_skip_rate',
    'crossposted_views',
    'facebook_views',
    'completion_rate'
  )
order by column_name;
