-- ============================================================
-- Migration 002: updated_at Triggers
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_instagram_accounts_updated_at
  before update on public.instagram_accounts
  for each row execute function public.handle_updated_at();

create trigger trg_instagram_media_updated_at
  before update on public.instagram_media
  for each row execute function public.handle_updated_at();
