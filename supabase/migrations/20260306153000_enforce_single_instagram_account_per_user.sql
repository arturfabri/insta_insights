do $$
declare
  duplicate_user_ids text;
begin
  select string_agg(user_id::text, ', ' order by user_id::text)
    into duplicate_user_ids
  from (
    select user_id
    from public.instagram_accounts
    group by user_id
    having count(*) > 1
  ) duplicates;

  if duplicate_user_ids is not null then
    raise exception
      'Cannot enforce one Instagram account per user. Duplicate instagram_accounts rows exist for user_id(s): %',
      duplicate_user_ids;
  end if;
end
$$;

create unique index if not exists uq_instagram_accounts_user_id
  on public.instagram_accounts (user_id);

do $$
begin
  if exists (
    select 1
    from public.instagram_accounts
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Verification failed: duplicate instagram_accounts rows still exist per user_id.';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'instagram_accounts'
      and indexname = 'uq_instagram_accounts_user_id'
  ) then
    raise exception 'Verification failed: uq_instagram_accounts_user_id was not created.';
  end if;
end
$$;
