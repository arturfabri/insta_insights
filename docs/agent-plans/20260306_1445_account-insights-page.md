# Account Insights Page

## Current Status
- Completed

## Checklist
- [x] Add the `/insights` protected route and sidebar navigation entry.
- [x] Add validated account-insights data access plus aggregation helpers for day/week/month chart buckets.
- [x] Build the account insights page with KPI cards, charts, summary grid, and robust empty/error states.
- [x] Add unit, hook, and page tests covering aggregation, query validation, and rendering states.
- [x] Run the local quality gate and record the result.

## Progress Log (newest first)
- 2026-03-06 17:04: Removed the temporary `/insights` sync action after confirming it violated the intended UX ownership of `/connect`. Root cause was a seed-data mismatch: seeded `instagram_account_insights_daily` rows used `metric_type = 'seed_total_value'` and `timeframe = 'seed_day'` while the app correctly expects production-shaped rows (`metric_type = 'total_value'`, `timeframe = ''`). Updated the seed script and restored the original `/connect`-owned recovery path. Verification passed with `npm run test:all` and `npm run build`.
- 2026-03-06 16:55: Refined the `/insights` empty state after diagnosing that some connected accounts had no rows yet in `instagram_account_insights_daily`. The page now explains that the account is connected but the daily projection is empty, and offers a direct `Sync now` action instead of only sending the user back to `/connect`. Verification passed with `npm run test:all` and `npm run build`.
- 2026-03-06 14:56: Added `recharts`, the `/insights` route and sidebar entry, validated account-insights parsing, mixed aggregation helpers for `time_series` vs `total_value`, the new insights page with KPI cards and four chart sections, and full unit/page coverage. Verification passed with `npm run test:all` and `npm run build`.
- 2026-03-06 14:45: Created tracking file before code changes. Existing schema and RLS already support the page; the work is frontend route/data/visualization plus tests.

## Next Actions
1. Re-run `scripts/seed-instagram-business-discovery.sql` for the seeded account, or update existing seeded `instagram_account_insights_daily` rows in the database so they use `metric_type = 'total_value'` and `timeframe = ''`.

## Context Snapshot
- `/insights` is now a protected single-account page with day/week/month aggregation controls.
- The data boundary is validated with Zod before chart aggregation.
- The page renders KPI cards, performance trend, interaction mix, audience growth, profile action, and a summary grid, with empty/error/unavailable states covered by tests.
- `/insights` again defers recovery to `/connect`; no sync action remains on the page.
- Seeded `instagram_account_insights_daily` rows must now match production shape (`metric_type = 'total_value'`, `timeframe = ''`) for the page to load them.
