# Account Insights Metric-Type Alignment

## Current Status
- Completed

## Checklist
- [x] Add the persisted implementation plan before editing code.
- [x] Update the account metric bundle contract so sync requests match Meta's metric matrix.
- [x] Add the `replies` daily projection column and align sync storage with the new bundle split.
- [x] Refactor `/insights` aggregation so UI rollups are driven by a local metric catalog instead of `metric_type`.
- [x] Update seed data and tests to reflect the production-shaped account insights contract.
- [x] Run the local quality gate and record the result.

## Progress Log (newest first)
- 2026-03-06 18:34: Aligned the account insights flow end-to-end. Replaced the duplicated bundle CSVs with an explicit provider bundle catalog, added the `replies` column via `20260306183500_add_replies_to_account_insights_daily.sql`, extracted a tested daily-projection helper, switched `/insights` to local per-metric aggregation rules, and updated the seed script so account insights rows/facts mirror production shape. Verification passed with `npm run test:all`, `npm run test:all:security`, and `npm run build`.
- 2026-03-06 18:25: Created tracking file before code changes. Confirmed the current mismatch: sync requests duplicated account metrics across `time_series` and `total_value`, `instagram_account_insights_daily` does not yet include `replies`, and `/insights` incorrectly interprets Meta's `metric_type` as the bucket aggregation rule.

## Next Actions
1. Rerun `scripts/seed-instagram-business-discovery.sql` in the dev database after applying the new migration so the seeded account picks up the new `time_series` + `total_value` split and the `replies` column.
2. If demographic facts are needed in the UI later, add a dedicated consumer over `instagram_metric_facts`; the sync path now preserves their timeframe and breakdown metadata, but `/insights` still intentionally excludes them.

## Context Snapshot
- Meta's official metric matrix for the account insights page shows `reach` as `total_value,time_series`, most daily activity metrics as `total_value`, and demographics as `lifetime total_value`.
- The app should keep storing provider `metric_type` faithfully, but the `/insights` page needs its own local aggregation semantics for weekly/monthly rollups.
- `instagram_account_insights_daily` remains the `/insights` source for daily chartable metrics only; it now includes `replies`, stores `reach` in `time_series`, stores activity totals in `total_value`, and leaves demographics in `instagram_metric_facts`.
