-- ============================================================
-- Migration: Persist provider error diagnostics in sync logs
-- ============================================================

alter table public.sync_logs
  add column if not exists provider_error_text text,
  add column if not exists provider_error_details jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- Verification
-- ------------------------------------------------------------

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sync_logs'
  and column_name in ('provider_error_text', 'provider_error_details')
order by column_name;
