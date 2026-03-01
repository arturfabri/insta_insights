---
name: audit-observability-guardian
description: Trigger when changes introduce approvals, state transitions, RBAC/admin actions, notifications/emails, Edge Functions, webhooks, or any failure-prone side effect. This skill enforces audit trails, structured logging, error classification, retry/idempotency strategy, and admin-visible failure reporting.
---

# Audit & Observability Guardian (Audit Trails + Logs + Failures)

You are responsible for making the system debuggable and governable as it scales across domains and actors.

As more operations onboard, you must be able to answer:
- Who changed what?
- When did it happen?
- Why did it fail?
- Did the user get notified?
- Can we retry safely?

---

## When to trigger
Trigger this skill when changes include:
- Any approval / role grant / admin config
- Any workflow state transition
- Any side effect: emails, notifications, webhooks, background jobs
- Any Edge Function creation/modification
- Any “automation rule” evaluation and execution
- Any cross-domain operation or privileged action
- Any CSV import/bulk operations
- Any data correction tools (admin fixes)

## When NOT to trigger
Do not trigger for:
- Pure UI styling changes
- Non-user-impacting refactors with no behavioural change

---

## Non-negotiable rules
1) All critical actions must be auditable.
2) Failures must be visible to admins/agents (not silent).
3) Side effects must be idempotent and retryable (where applicable).
4) Logs must be structured and searchable.
5) Audit logs must contain actor + target + action + timestamp + metadata.

---

## Required workflow (always follow)

### Step 1 — Identify auditable actions
List actions introduced/modified:
- RBAC grants/changes
- config edits
- imports
- state changes
- external calls

Classify each as:
- Critical (must audit)
- Important (should audit)
- Informational (optional)

### Step 2 — Define audit event schema
Recommended table:

`audit_events`
- `id`
- `created_at`
- `domain_key`
- `actor_user_id`
- `action` (string key)
- `target_type` (e.g., instagram_account, media, sync_run, brief_job)
- `target_id`
- `metadata` (jsonb)
- `request_id` / `correlation_id` (optional)
- `success` boolean
- `error_code` text null
- `error_message` text null

### Step 2.1 - Audit action naming convention

Use stable, namespaced action keys:

`<domain>.<resource>.<verb>`

Examples:
- `rbac.role.granted`
- `instagram.account.connected`
- `instagram.sync.completed`
- `notification.email.sent`
- `automation.rule.executed`

Rules:
- Action keys must be stable (do not rename without migration/compat plan).
- Prefer verbs that describe the user/system intent (approved/rejected/granted) over generic CRUD.

### Audit action keys vs RBAC permission keys

Audit action keys (e.g., `instagram.media.synced`) are event identifiers and are NOT RBAC permission keys.

They:
- May follow a similar `<domain>.<resource>.<event>` style
- Are not constrained to the approved RBAC permission verb set
- Do not grant or imply access rights
- Exist solely for observability, traceability, and forensic clarity

Do not apply RBAC verb restrictions to audit action names.

### Step 3 — Decide where to write audit events
Use this rubric:
- If action is DB transition via RPC → write audit row in same transaction
- If action is Edge Function side effect → write audit row from Edge Function with correlation_id
- If action is client-only and safe (rare) → still write audit via RPC

### Step 3.1 - Correlation & tracing contract

- Generate a `correlation_id` at the request boundary (client request or Edge Function entry).
- Propagate the same `correlation_id` through:
  - client → RPC/Edge → DB audit row → outbox/delivery log
- Prefer a UUID or stable request ID; do not reuse across unrelated actions.
- Log entries must include correlation_id for searchability.


### Step 4 — Error taxonomy (minimum)
Define error codes:
- `VALIDATION_ERROR`
- `PERMISSION_DENIED`
- `RLS_DENIED`
- `NOT_FOUND`
- `CONFLICT`
- `PROVIDER_ERROR`
- `TIMEOUT`
- `UNKNOWN`

### Step 5 — Side effect observability
For emails/notifications/automations:
- maintain a delivery log/outbox table (or reuse existing logs)
- store provider message id if available
- record status transitions (queued → sent → failed)
- record retries count + last error

### Step 5.1 - Outbox preference (recommended)

When an action triggers side effects (email/webhook/notification), prefer an **outbox** record written in the same transaction as the state change:
- DB state transition + outbox row committed together
- Worker/Edge function processes outbox rows idempotently
- Outbox row tracks attempts, provider ids, and final status

This prevents "state changed but side effect lost" and supports safe retries.

### Step 6 — Admin-visible failure reporting
If a critical side effect fails:
- create notification for relevant role (admin/agents)
- add a “retry” capability (where safe)
- ensure failures are discoverable (dashboard/filter)

### Step 7 — Idempotency + retries
For webhooks/email sends:
- store idempotency key (e.g., provider event id, session id)
- ensure reprocessing does not duplicate effects
- retry policy:
  - limited attempts
  - exponential backoff (if implemented in Edge)
  - manual retry button for admins

---

## Definition of Done (Acceptance Criteria)

A change is complete only if:

1) All **Critical** actions write an audit event on success AND failure.
2) Every audit event includes:
   - actor_user_id, action, target_type, target_id, created_at, success
   - correlation_id/request_id (or explicit reason why unavailable)
3) All side effects (emails/notifications/webhooks) are observable:
   - provider id recorded when available
   - status transitions tracked (queued → sent → failed)
   - last_error and retry_count recorded
4) Idempotency is enforced for failure-prone side effects (no duplicates on retry).
5) Admins can discover failures (filterable view) and safely retry where applicable.
6) No secrets or sensitive tokens are stored in metadata.

---

## Output format (must follow)
1) **Auditable Actions Inventory**
2) **Audit Schema Recommendation**
3) **Logging & Correlation Plan**
4) **Failure Handling Plan**
5) **Idempotency/Retry Strategy**
6) **DB/Edge Deliverables**
7) **Test Plan**

---

## Guardrails
- Don’t over-audit trivial actions; focus on governance-critical paths.
- Never store secrets or sensitive tokens in audit metadata.
- Avoid huge metadata blobs; store identifiers, not full payloads.
- Ensure audit events are append-only (no updates).
- PII discipline:
  - Store identifiers, not full personal payloads (no addresses, DOBs, emails, phone numbers unless strictly required).
  - If user-visible identity is needed, store a stable reference (user_id/media_id/account_id) and resolve in UI.
- Retention:
  - Audit events are append-only and should have a retention policy (e.g., 12–24 months) unless legal requirements demand longer.
  - If retention is required, prefer archiving to cold storage rather than deleting silently.
