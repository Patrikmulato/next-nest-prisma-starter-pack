# Hardening Backlog

Last updated: 2026-07-30
Branch context: hardening-stg

## Completed on this branch

- S2: CORS origin matching tightened to project-safe allow patterns.
- S4: JWT insecure fallback blocked outside local/test.
- S5/S10: Global rate limiting applied via APP_GUARD, with route-specific overrides preserved.
- S6: 500 error responses no longer leak internal details.
- S9: Tooltip HTML output is escaped server-side.
- C3: Shared-store enforcement in production for cache and rate limiting (Upstash required).
- C4: Health readiness endpoint added with database check.
- C5: In-memory cache increment regression fixed.
- O2: Filter cache TTL added.

## Remaining backlog

### Security

- S1: Migrate refresh token transport to secure HTTP-only cookie flow.

### Priorities (Current)

- P0 (done): S1, C2, D1 — implemented on branch `hardening-p0-s1-c2-d1`
- P1 (high): T2, X1, O1, C1
- P2 (medium): P1, P2, P3, A3
- P3 (lower / iterative): P4, A1, A2, A4

## Discovered Fix Plans

### P0 - Immediate

#### S1: Refresh Token Cookie Migration

- Goal: remove refresh token from JSON body transport and move to secure cookie transport.
- Plan:
  - Update auth endpoints to set `refresh_token` with `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` if UX allows), and bounded path (for example `/api/auth/refresh`).
  - Accept refresh token from cookie in refresh flow; keep short transition period for body token only behind feature flag if needed.
  - Add CSRF protection for refresh/logout (`Origin` check + CSRF token or double-submit cookie).
  - Update frontend auth client to rely on `credentials: 'include'` and stop persisting refresh token in local storage/state.
  - Add e2e tests for login/refresh/logout cookie semantics and rejection paths.
- Exit criteria:
  - No refresh token appears in response body, logs, or frontend storage.
  - Refresh works only with valid cookie and CSRF protections.

#### C2: Upstash Outage Resilience Policy

- Goal: define deterministic behavior when shared store is unavailable in production.
- Plan:
  - Choose explicit policy per endpoint group:
    - Auth and write-sensitive paths: fail-closed (current behavior).
    - Read-only, low-risk paths: optional fail-open with strict fallback window and alerts.
  - Implement policy switches in `RateLimitStore` and `CacheStore` with typed config flags.
  - Add structured error/metric events when policy fallback or fail-closed paths trigger.
  - Add integration tests for store timeout/down cases to confirm selected behavior.
- Exit criteria:
  - Policy is documented and codified; behavior is predictable under outage.

#### D1: CI Hardening Gates

- Goal: prevent accidental regressions of hardening controls.
- Plan:
  - Add CI checks that assert production-required env policy (including Upstash vars).
  - Add test that ensures global `RateLimitGuard` remains registered via `APP_GUARD`.
  - Add lint/check script to detect forbidden insecure fallbacks in production code paths.
  - Wire checks into PR workflow as required status checks.
- Exit criteria:
  - PRs fail if guard wiring, env requirements, or fallback protections regress.

### P1 - High

#### T2: Production-Like E2E Matrix

- Plan:
  - Add test matrix for `NODE_ENV=production` with and without required env values.
  - Validate startup fails fast when required variables are missing.
  - Validate rate-limit and cache behavior under production config.

#### X1: Negative-Path External Service Tests

- Plan:
  - Simulate Upstash latency, non-200 responses, and malformed payloads.
  - Assert expected fail-closed/open behavior based on chosen C2 policy.
  - Capture regression tests for error messages and status codes.

#### O1: Incident Runbook for Shared Store Dependency

- Plan:
  - Document alert signals, immediate triage steps, and rollback toggles.
  - Include how to validate service health (`/api/health`, `/api/health/ready`) during incidents.
  - Include recovery verification checklist.

#### C1: Error Boundary Coverage for Store Failures

- Plan:
  - Normalize thrown errors from cache/rate-limit stores into domain-specific exceptions.
  - Ensure global exception filter maps them to expected API responses and logs context safely.
  - Add tests for conversion and response shape.

### P2 - Medium

#### P1/P2: Filter Path Performance and Budgeting

- Plan:
  - Benchmark `POST /api/data/filter` under representative payload and concurrency.
  - Add timing instrumentation and percentile reporting.
  - Define SLO budgets and alert thresholds.

#### P3: Cache Key and Versioning Review

- Plan:
  - Audit key cardinality and invalidation events.
  - Add key naming conventions and a version bump strategy doc.
  - Add tests for stale-read prevention across invalidation boundaries.

#### A3: Config Surface Standardization

- Plan:
  - Centralize hardening-related config in one typed config module.
  - Eliminate duplicated env lookups in lower-level services where practical.
  - Add config validation tests.

### P3 - Iterative

#### P4: Selective Pre-computation

- Plan:
  - Identify top filter combinations from usage data.
  - Prototype precomputed result buckets and compare memory/latency trade-offs.

#### A1/A2/A4: Architecture and Operational Consistency

- Plan:
  - Document module ownership boundaries and guard/interceptor order constraints.
  - Add deployment checklist as executable verification steps where possible.
  - Fold docs into PR template and release checklist.

### Correctness and scalability

- C1: Add stronger error boundary coverage for external store failures.
- C2: Add resilience strategy for transient Upstash outages (with explicit policy).

### Performance and architecture

- P1: Audit expensive filter path operations under load.
- P2: Add endpoint-level profiling and budget thresholds.
- P3: Expand cache key/versioning strategy review.
- P4: Evaluate selective pre-computation for high-traffic filters.
- A1: Review module boundaries and shared utility ownership.
- A2: Document guard/interceptor execution order and constraints.
- A3: Standardize cache and rate-limit configuration surface.
- A4: Define deployment-time hardening checklist as code.

### Testing and quality

- T2: Add broader e2e coverage for production-like env constraints.
- X1: Add negative-path tests for unavailable external backing services.

### Delivery and ops

- D1: Add CI gate for hardening policy checks (required env and guard wiring).
- O1: Add runbook for production incident handling around external store dependency.

## Notes

- This file tracks hardening work discovered during review and implementation.
- Source-of-truth code changes are in branch commits, including 0b6ca0e.
