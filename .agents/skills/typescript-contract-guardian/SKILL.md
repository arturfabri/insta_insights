---
name: typescript-contract-guardian
description: Trigger when changes add or modify any boundary where data crosses
  trust zones, including Supabase queries or RPC responses, CSV imports,
  form submissions, webhooks, Edge Functions, JSON config in DB, and any
  cross-domain safe projection. This skill enforces TypeScript-first API
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
-   Cross-domain safe projections (e.g., People search)
-   Nested joins or complex queries

### Inputs from untrusted sources

-   CSV upload or import
-   Complex forms
-   Route params (domainKey, ids)
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

## Safe Projection Example (People search)

``` ts
import { z } from 'zod'

export const PersonSafeSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  mobile: z.string().min(6).optional(),
})

export type PersonSafe = z.infer<typeof PersonSafeSchema>
```

## Validating RPC Output

``` ts
const result = await supabase.rpc('people_search', { query })

const parsed = PersonSafeSchema.array().safeParse(result.data)

if (!parsed.success) {
  throw new Error('Invalid PeopleSearch RPC payload')
}

const people: PersonSafe[] = parsed.data
```

------------------------------------------------------------------------

## CSV Validation Example

``` ts
export const VolunteerCsvRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().min(6),
  role: z.string().min(1),
  placeOfWorship: z.string().min(1),
})
```

Usage:

``` ts
const rowResult = VolunteerCsvRowSchema.safeParse(row)

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
export const DomainKeySchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/)

export const IdSchema = z.string().uuid()
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
