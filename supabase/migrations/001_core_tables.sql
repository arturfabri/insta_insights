-- ============================================================
-- Migration 001: Core Tables
-- ============================================================

-- ============================================================
-- TABLE: instagram_accounts
-- One row per connected Instagram account per Supabase user
-- ============================================================
create table public.instagram_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  instagram_user_id   text not null,
  username            text not null,
  -- Token stored encrypted (AES-256-GCM); never exposed to frontend
  access_token_enc    text not null,
  token_expires_at    timestamptz not null,
  last_synced_at      timestamptz,
  sync_status         text not null default 'pending'
                        check (sync_status in ('pending','syncing','complete','error')),
  sync_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, instagram_user_id)
);

alter table public.instagram_accounts enable row level security;

create policy "Users can view their own accounts"
  on public.instagram_accounts for select
  using (auth.uid() = user_id);

create policy "Users can update their own accounts"
  on public.instagram_accounts for update
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: instagram_media
-- One row per post/reel/carousel
-- ============================================================
create table public.instagram_media (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  media_id            text not null,
  media_type          text not null check (media_type in ('IMAGE','VIDEO','CAROUSEL_ALBUM')),
  -- is_reel: true for VIDEO with product_type=clips
  is_reel             boolean not null default false,
  caption             text,
  permalink           text,
  thumbnail_url       text,
  media_url           text,
  timestamp           timestamptz not null,
  -- Reel-specific
  duration_seconds    numeric(6,2),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (account_id, media_id)
);

alter table public.instagram_media enable row level security;

create policy "Users can view their own media"
  on public.instagram_media for select
  using (auth.uid() = user_id);

create index idx_instagram_media_account_id on public.instagram_media(account_id);
create index idx_instagram_media_timestamp  on public.instagram_media(timestamp desc);

-- ============================================================
-- TABLE: instagram_media_insights
-- One row per media item; upserted on each sync
-- ============================================================
create table public.instagram_media_insights (
  id                    uuid primary key default gen_random_uuid(),
  media_id_fk           uuid not null references public.instagram_media(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  -- Core metrics
  reach                 integer not null default 0,
  impressions           integer not null default 0,
  plays                 integer,          -- Reels only
  video_views           integer,          -- VIDEO (non-reel)
  avg_watch_time_sec    numeric(8,2),     -- Reels proxy for retention
  total_watch_time_ms   bigint,
  likes                 integer not null default 0,
  comments              integer not null default 0,
  shares                integer not null default 0,
  saves                 integer not null default 0,
  profile_visits        integer not null default 0,
  follows               integer not null default 0,
  -- Denormalized for quick sorting
  engagement_rate       numeric(8,6),
  synced_at             timestamptz not null default now(),
  unique (media_id_fk)
);

alter table public.instagram_media_insights enable row level security;

create policy "Users can view their own insights"
  on public.instagram_media_insights for select
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: scoring_results
-- Persisted scores; recalculated client-side, saved here
-- ============================================================
create table public.scoring_results (
  id                      uuid primary key default gen_random_uuid(),
  media_id_fk             uuid not null references public.instagram_media(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  goal                    text not null check (goal in ('growth','leads')),
  total_score             numeric(5,2) not null,
  -- Growth sub-scores
  distribution_score      numeric(5,2),
  engagement_depth_score  numeric(5,2),
  conversion_score        numeric(5,2),
  retention_score         numeric(5,2),
  -- Leads sub-scores
  value_score             numeric(5,2),
  consideration_score     numeric(5,2),
  -- Raw weights snapshot for auditability
  weights_snapshot        jsonb,
  calculated_at           timestamptz not null default now(),
  unique (media_id_fk, goal)
);

alter table public.scoring_results enable row level security;

create policy "Users can view their own scores"
  on public.scoring_results for select
  using (auth.uid() = user_id);

create policy "Users can insert their own scores"
  on public.scoring_results for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own scores"
  on public.scoring_results for update
  using (auth.uid() = user_id);

-- ============================================================
-- TABLE: content_recommendations
-- AI-generated content briefs, stored per generation run
-- ============================================================
create table public.content_recommendations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.instagram_accounts(id) on delete cascade,
  goal            text not null check (goal in ('growth','leads')),
  request_params  jsonb not null,
  briefs          jsonb not null,
  generated_at    timestamptz not null default now(),
  exported_formats text[] default '{}'
);

alter table public.content_recommendations enable row level security;

create policy "Users can view their own recommendations"
  on public.content_recommendations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recommendations"
  on public.content_recommendations for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- TABLE: sync_logs
-- Audit trail for all data ingestion runs
-- ============================================================
create table public.sync_logs (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.instagram_accounts(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  sync_type       text not null check (sync_type in ('initial','manual','cron')),
  status          text not null check (status in ('started','complete','partial','error')),
  posts_fetched   integer,
  posts_updated   integer,
  error_message   text,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);

alter table public.sync_logs enable row level security;

create policy "Users can view their own sync logs"
  on public.sync_logs for select
  using (auth.uid() = user_id);
