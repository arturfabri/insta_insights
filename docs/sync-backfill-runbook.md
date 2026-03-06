# Sync Backfill Runbook

This project includes a helper script to run bounded Instagram sync backfills through the `instagram-sync` Edge Function.

## Command

```bash
npm run sync:backfill -- --account-id <account-uuid> --backfill-days 90
```

## Environment

The script loads missing variables from project `.env.local` (and `.env`) automatically.

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `BACKFILL_EMAIL`
- `BACKFILL_PASSWORD`

Optional values:

- `BACKFILL_ACCOUNT_ID`
- `BACKFILL_ACCOUNT_IDS` (comma-separated)
- `BACKFILL_DAYS` (`90`, `180`, or `360`)
- `BACKFILL_SCOPES` (comma-separated: `media,account,businessDiscovery`)

## Common Runs

Dry-run all accessible accounts:

```bash
npm run sync:backfill -- --dry-run --all-accounts
```

Run for all accessible accounts (90 days):

```bash
npm run sync:backfill -- --all-accounts --backfill-days 90
```

Run for a specific account:

```bash
npm run sync:backfill -- --account-id <account-uuid> --backfill-days 90
```

Run a scoped sync (media + account only):

```bash
npm run sync:backfill -- --account-id <account-uuid> --backfill-days 90 --scopes media,account
```

## Output

Each target account logs one result line:

- `OK` with `postsProcessed`, `insightErrors`, and `partial`
- `FAILED` with parsed function error details when available

## Verify Results in SQL Editor

```sql
select
  id,
  account_id,
  status,
  sync_type,
  sync_mode,
  sync_period_days,
  posts_processed,
  posts_upserted,
  insight_errors,
  capability_gaps,
  created_at
from public.sync_logs
where sync_mode = 'backfill'
order by created_at desc
limit 50;
```
