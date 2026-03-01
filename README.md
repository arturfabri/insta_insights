# Insta Insights (Working Codename)

Internal codename: `Insta Insights`.
Note: this codename should be renamed before public release due Instagram/Meta trademark restrictions.

## Overview

Insta Insights is a React + TypeScript web app backed by Supabase that helps creators analyze Instagram post performance and generate AI content briefs from what is already working.

Core workflow:
1. User signs up/signs in with Supabase Auth.
2. User connects Instagram via OAuth.
3. App syncs media + insights into Supabase.
4. Frontend computes per-post scores (Growth or Leads objective).
5. Recommendations page extracts patterns and generates new content briefs via an Edge Function.
6. Briefs can be exported as Markdown, copied to clipboard, or exported as PDF.

## Tech Stack

- Frontend: React 19, TypeScript, Vite 7
- Routing: React Router 7
- Styling: Tailwind CSS v4 (theme tokens in `src/index.css`)
- Backend: Supabase (Auth, Postgres, RLS, Realtime, Edge Functions)
- Testing: Vitest + Testing Library + jsdom
- AI generation: Anthropic Messages API (via Supabase Edge Function)

## Product Features (Current)

- Email/password authentication (Supabase Auth)
- Protected app routes and shared shell layout
- Instagram OAuth connect flow
- On-demand sync windows: 90 / 180 / 360 days
- Live sync status via Supabase Realtime
- Sync state handling: `pending`, `syncing`, `complete`, `partial`, `error`
- Dashboard with:
  - media filters (All, Images, Carousels, Reels)
  - sorting by timestamp, reach, engagement rate, score
  - per-post score badges
- Post detail view with:
  - metric cards
  - median deltas
  - score breakdown and improvement hints
- Recommendations with:
  - top-performer detection (top 20%)
  - pattern extraction (format mix, captions, hashtags, CTA, posting time)
  - AI-generated content briefs
- Export options:
  - Markdown download
  - copy to clipboard
  - PDF export

## Architecture

### Frontend

- Entry: `src/main.tsx`
- Root/router: `src/App.tsx`
- Global providers:
  - `AuthProvider` (`src/context/AuthContext.tsx`)
  - `GoalProvider` (`src/context/GoalContext.tsx`)
- Pages:
  - `/login`, `/signup`
  - `/oauth/callback`
  - `/` (Dashboard)
  - `/posts/:id`
  - `/recommendations`
  - `/connect`
- Data hooks:
  - `useInstagramAccount`
  - `useSyncStatus`
  - `useMediaList`
  - `useMediaDetail`
  - `useScoringEngine`
  - `usePersistScores`

### Backend (Supabase)

- SQL migrations: `supabase/migrations`
- Edge functions: `supabase/functions`
- Realtime used for sync banner updates (`instagram_accounts` updates)
- RLS enabled on all app tables

## Database Schema (from migrations)

Main tables:
- `instagram_accounts`
  - connected account metadata
  - encrypted token storage (`access_token_enc`)
  - sync status and sync errors
- `instagram_media`
  - synced posts/reels/carousels
- `instagram_media_insights`
  - per-media metrics (reach, saves, shares, etc.)
- `scoring_results`
  - persisted computed scores by goal (`growth` or `leads`)
- `content_recommendations`
  - generated briefs + request metadata
- `sync_logs`
  - audit trail per sync run

Migration files:
- `001_core_tables_20260301194643.sql`
- `002_updated_at_triggers_20260301194643.sql`
- `003_sync_status_partial_20260301194643.sql`

## Scoring Model

Scoring is computed client-side (`src/lib/scoring.ts`) using p95 normalization across the account's posts:

- Growth weights:
  - distribution (shares/reach): 30%
  - saves/reach: 25%
  - comments/reach: 15%
  - follows/reach: 20%
  - retention: 10%

- Leads weights:
  - value (saves/reach): 30%
  - distribution (shares/reach): 20%
  - consideration (profile visits/reach): 25%
  - follows/reach: 15%
  - CTA keyword signal: 10%

Scores are persisted to `scoring_results` via debounced upsert in `usePersistScores`.

## Edge Functions

| Function | Purpose | Auth Model |
|---|---|---|
| `instagram-oauth` | Exchanges auth code for long-lived token, encrypts token, upserts connected account | Requires user JWT |
| `instagram-sync` | Pulls media + insights, upserts DB rows, writes sync logs/status | Requires user JWT |
| `generate-brief` | Calls Anthropic, validates/returns JSON briefs, stores run in DB, enforces daily cap | Requires user JWT |
| `daily-sync` | Cron fan-out sync for all non-syncing accounts | `X-Cron-Secret` |
| `token-refresh` | Cron refresh for expiring Instagram tokens | `X-Cron-Secret` |

Operational notes:
- `instagram-sync` currently caps at 400 posts and uses rate-limit headroom logic.
- `generate-brief` daily limit is 10 generations per user.
- Sync can end in `partial` when rate limit is reached.

## Environment Variables

### Frontend (`.env.local`)

Required by Vite client:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_META_APP_ID=
```

### Edge Function Secrets (Supabase project secrets)

Required across functions:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TOKEN_ENCRYPTION_KEY=
META_APP_ID=
META_APP_SECRET=
ANTHROPIC_API_KEY=
CRON_SECRET=
```

From `.env.example`, additional optional local testing values are present:

```bash
META_TEST_ACCESS_TOKEN=
INSTA_ACCESS_TOKEN=
```

Security expectations:
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Never expose `META_APP_SECRET` or `ANTHROPIC_API_KEY` to the browser.
- `TOKEN_ENCRYPTION_KEY` should be generated with strong entropy (32-byte hex key).

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure env

- Copy `.env.example` values into `.env.local`.
- Set real Supabase project URL/anon key and Meta app id.

### 3) Run frontend

```bash
npm run dev
```

### 4) Run quality checks

```bash
npm run lint
npm test
npm run build
```

## Supabase Setup and Migrations

Project includes helper scripts targeting the configured dev project ref:
- `scripts/db-status-dev.sh`
- `scripts/db-push-dev.sh`

Example usage:

```bash
bash scripts/db-status-dev.sh
bash scripts/db-push-dev.sh
```

If using local Supabase CLI workflow, this repo already contains:
- `supabase/config.toml`
- SQL migrations under `supabase/migrations/`

## Testing Coverage (Current)

Tests currently cover:
- scoring math and baselines
- pattern extraction logic
- hooks (`useMediaList`, `useSyncStatus`, `useScoringEngine`)
- login form behavior
- OAuth callback error/processing states
- sync status banner rendering and retry actions

Run:

```bash
npm test
npm run test:watch
npm run test:ui
```

## Project Structure

```text
src/
  components/
  context/
  hooks/
  lib/
    export/
  pages/
  test/
  types/
supabase/
  functions/
  migrations/
scripts/
docs/
```

## Known Notes

- Branding: product name is temporary and should be changed.
- `supabase/config.toml` references `./seed.sql`, but `supabase/seed.sql` is not currently present.
- CORS helper in edge functions currently allows `*`; tighten this for production deployments.

## License

No license file is currently present in this repository.
