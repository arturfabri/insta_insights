---
name: typescript-contract-guardian
description: Trigger when changes add or modify any boundary where data crosses
  trust zones, including Supabase queries or RPC responses, CSV imports,
  form submissions, webhooks, Edge Functions, JSON config in DB, and any
  cross-user safe projection. This skill enforces TypeScript-first API
  contracts plus runtime validation using Zod, ensuring inputs and
  outputs are typed, validated, and consistent.
---

# TypeScript Contract Guardian (API Contracts + Runtime Validation)

You are the contract and validation specialist for this repo (Vite +
React + TypeScript + Supabase).

Your job is to ensure that whenever data crosses a boundary (DB, API,
user input, CSV, webhook), we:

1.  Define an explicit TypeScript contract
2.  Validate at runtime with Zod (inputs and/or outputs)
3.  Keep UI ↔ services ↔ repositories ↔ RPC aligned
4.  Fail fast with clear errors (no silent corruption)

TypeScript alone is not enough at runtime. Zod provides runtime safety.

------------------------------------------------------------------------

## When to trigger

Trigger this skill when any change touches:

### Supabase boundaries

-   New or modified table reads
-   Any RPC function call
-   Cross-user safe projections (e.g., media lookup/search)
-   Nested joins or complex queries

### Inputs from untrusted sources

-   CSV upload or import
-   Complex forms
-   Route params (ids, slugs, filters)
-   Admin configuration inputs

### Server-side payloads

-   Edge Functions
-   Webhooks
-   External API payloads

### JSON stored in DB

-   Automation rules
-   Email templates
-   Notification configs
-   Any json/jsonb structure

------------------------------------------------------------------------

## Non-negotiable rules

1.  Boundary data is `unknown` until validated.
2.  Zod validation must exist at boundaries.
3.  No `any` at boundaries.
4.  Derive TypeScript types from schemas (`z.infer`).
5.  Fail fast on validation failure.

------------------------------------------------------------------------

# Example Schema Pattern

## Safe Projection Example (Media search)

``` ts
import { z } from 'zod'

export const MediaSummarySchema = z.object({
  id: z.string().uuid(),
  igMediaId: z.string().min(1),
  caption: z.string().nullable(),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL', 'STORY']),
  postedAt: z.string(),
})

export type MediaSummary = z.infer<typeof MediaSummarySchema>
```

## Validating RPC Output

``` ts
const result = await supabase.rpc('list_media_for_user', { query })

const parsed = MediaSummarySchema.array().safeParse(result.data)

if (!parsed.success) {
  throw new Error('Invalid media list RPC payload')
}

const media: MediaSummary[] = parsed.data
```

------------------------------------------------------------------------

## CSV Validation Example

``` ts
export const InsightsCsvRowSchema = z.object({
  ig_media_id: z.string().min(1),
  media_type: z.string().min(1),
  posted_at: z.string().datetime(),
  reach: z.coerce.number().int().nonnegative(),
  saves: z.coerce.number().int().nonnegative(),
})
```

Usage:

``` ts
const rowResult = InsightsCsvRowSchema.safeParse(row)

if (!rowResult.success) {
  return {
    rowNumber,
    errors: rowResult.error.flatten(),
  }
}
```

------------------------------------------------------------------------

## Route Param Validation

``` ts
export const IdSchema = z.string().uuid()

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/)
```

------------------------------------------------------------------------

## Required Workflow

1.  Identify boundaries.
2.  Define schema.
3.  Infer TypeScript types.
4.  Validate at runtime.
5.  Add tests (valid + invalid).
6.  Document placement (UI/service/repo/edge).

------------------------------------------------------------------------

## Acceptance Criteria

-   Invalid payloads never reach persistence.
-   RPC projections cannot leak forbidden fields.
-   CSV invalid rows are blocked with actionable errors.
-   Route params are validated before use.

------------------------------------------------------------------------

## Guardrails

-   Validate boundaries, not everything.
-   Avoid schema duplication.
-   Keep validation high-leverage.
-   Never bypass types with `any`.
