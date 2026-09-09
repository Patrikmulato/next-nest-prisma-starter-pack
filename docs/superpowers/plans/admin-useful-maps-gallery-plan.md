# Admin Useful Maps Gallery — Agent Notes

## Required Reading Order

Before planning or implementing this feature, read:

1. `AGENTS.md`
2. `.clinerules`
3. This file (`docs/superpowers/plans/admin-useful-maps-gallery-plan.md`) — the authoritative specification for this feature.
4. `docs/superpowers/plans/admin-useful-maps-gallery-progress.md`
5. The relevant existing files named in [Existing Patterns That Must Be Inspected](#existing-patterns-that-must-be-inspected).

If this file conflicts with repository behavior or `AGENTS.md`, stop and describe the conflict before changing code.

## Purpose

This feature replaces the build-time `public/useful-maps/` directory scan with an admin-managed gallery.

The target architecture is:

- Images live in Vercel Blob with public read access.
- Useful Map metadata lives in PostgreSQL through Prisma.
- NestJS owns records, public listing, ticket issuance, authorization, Blob verification, deletion, cleanup, cache invalidation, and audit logging.
- Next.js owns public/admin UI and the browser-facing Vercel Blob upload authorization route.
- Authenticated users with the ADMIN role are required for all map mutation operations.
- Existing public zoom/pan viewer and sidebar behavior must remain intact.

## Required Implementation Workflow

Maintain `docs/superpowers/plans/admin-useful-maps-gallery-progress.md`. For each completed task range, record:

- Task IDs or plan section.
- Changed files.
- Tests and validation commands run.
- Results.
- Any unresolved issue or explicit follow-up.

## Milestones

### M0 — Repository Reconnaissance

Read the existing implementation patterns named in [Existing Patterns That Must Be Inspected](#existing-patterns-that-must-be-inspected).

Produce a repository-specific implementation map covering:

- Exact files to create or modify.
- Existing DTO, validation, pagination, cache, logging, auth, rate-limit, response envelope, environment, API-client, session, and test conventions.
- Exact package scripts available for validation.
- Conflicts, ambiguity, and prerequisites.

Do not edit source files during M0.

### M1 — Prisma Schema and Migration

Implement only:

- `UsefulMapCategory`.
- `UsefulMap`.
- `User.uploadedUsefulMaps`.
- Committed migration `add_useful_maps_gallery`.

Format the schema, generate Prisma client code, inspect migration SQL, and apply only to a confirmed local development database using the repository-established workflow.

Do not implement backend endpoints, Blob behavior, frontend UI, or deployment configuration during M1.

### M2 — Backend Module Foundations

Implement module setup only:

- Useful Maps module structure.
- DTO structure.
- Canonical category label source.
- Validated backend configuration.
- Narrow backend Blob adapter.
- Module registration.

Reuse project patterns. Do not implement incomplete security behavior as temporary shortcuts.

### M3 — Public Backend Endpoints

Implement and test:

- Public categories endpoint.
- Public paginated listing endpoint.
- Category validation.
- Pagination.
- Standard response envelope.
- Public rate limits.
- Versioned public-gallery cache behavior.

### M4 — Admin Backend Endpoints

Implement and test separately, in this order:

1. Upload-ticket issuance.
2. Ticket claim verification helpers.
3. Metadata creation and authoritative Blob `head()` verification.
4. Metadata update.
5. Blob-first delete behavior.
6. Compensating cleanup behavior.
7. Cache invalidation and structured audit logs.

Do not merge these into one large agent task.

### M5 — Next.js Blob Upload Authorization Route

Implement only the Next.js route responsible for client-upload authorization.

It must:

- Verify the dedicated upload ticket.
- Enforce issuer, audience, role, expiry, and exact pathname prefix.
- Restrict MIME types and file size.
- Use public Blob access.
- Create Vercel Blob client-upload authorization only.
- Never create, modify, or delete `UsefulMap` database records.
- Never log upload ticket contents or Blob credentials.

### M6 — Frontend API Contracts

Implement frontend types and typed API methods through the existing `ApiClient`.

Direct Vercel Blob transfer is the only client request permitted to bypass the NestJS API client.

### M7 — Public Gallery UI

Refactor the public useful-maps experience to use the backend API.

Preserve:

- Zoom/pan viewer behavior.
- Sidebar navigation behavior.
- Existing keyboard behavior.
- Stable image layout behavior.

Add category filtering, loading, error, empty, and pagination/load-more states.

Remove filesystem scan behavior only when its replacement is complete and validated.

### M8 — Admin Dashboard UI

Implement:

- Explicit session restoration.
- Unauthenticated redirect behavior.
- Non-admin unauthorized state.
- Title, category, and image input validation.
- Upload progress and in-flight state.
- Upload-ticket request.
- Direct Blob upload.
- Metadata creation after Blob upload.
- Cleanup attempt after metadata creation failure.
- Edit controls.
- Confirmation-based deletion.
- Post-mutation refresh behavior.

Do not display success until metadata persistence succeeds.

### M9 — Legacy Migration Script

Implement the committed manifest and one-off backend migration script.

Requirements include:

- No title/category inference from filename.
- Exact manifest validation.
- Deterministic legacy Blob paths.
- Existing ADMIN uploader lookup.
- Idempotent Blob/record behavior.
- Processed/created/skipped/failed totals.
- Nonzero exit on failure.

Do not remove static assets during this milestone.

### M10 — Full Validation and Manual Verification

Run the relevant test/build/format/type-check commands discovered in the repository.

Production migration, production Blob migration, static-asset deletion, and Vercel configuration changes require explicit human approval and must not be performed automatically.

## Critical Security Boundaries

### NestJS Is Authoritative

NestJS owns:

- `UsefulMap` database records.
- Public listing and category responses.
- Authorization and admin role enforcement.
- Upload-ticket issuance.
- Ticket verification for metadata creation and cleanup.
- Blob object verification.
- Blob deletion.
- Cleanup behavior.
- Cache invalidation.
- Structured audit logging.

### Next.js Upload Route Is Limited

The Next.js upload route owns only browser-facing Vercel Blob upload authorization.

It must not:

- Create `UsefulMap` records.
- Update `UsefulMap` records.
- Delete `UsefulMap` records.
- Delete Blob objects.
- Treat upload completion as metadata persistence.
- Expose secrets or Blob credentials to the browser.
- Log tickets, client payloads, complete headers, or credentials.

### Browser Limitations

The browser may:

- Request a dedicated upload ticket from NestJS.
- Request Vercel Blob upload authorization from the Next.js route.
- Upload directly to Vercel Blob.
- Submit uploaded Blob metadata and the ticket to NestJS.
- Request cleanup from NestJS after metadata persistence failure.

The browser must not receive a reusable Blob credential or server-only secret.

## Non-Negotiable Rules

- Do not write runtime uploaded files to `public/`.
- Do not expose Blob credentials in frontend code.
- Do not reuse the normal access JWT as the Blob upload ticket.
- Do not trust client-provided uploader IDs.
- Do not infer `uploadedById`; derive it from authenticated server-side user data.
- Do not create records from the Next.js upload-complete callback.
- Do not weaken ticket issuer, audience, role, expiry, subject, hostname, pathname prefix, MIME type, file-size, duplicate, or ownership validation.
- Do not delete the database record when Blob deletion has a genuine failure.
- Do not permit cleanup when a `UsefulMap` record already exists for the URL or Blob pathname.
- Do not run production migrations, production cleanup, production legacy migration, static asset removal, or deployment configuration changes without explicit approval.

## Existing Patterns That Must Be Inspected

Before implementation, inspect these files and reuse their conventions:

- `backend/prisma/schema.prisma`
- `backend/src/modules/saved-filters/`
- `backend/src/modules/auth/`
- `backend/src/common/cache/cache.store.ts`
- `backend/src/common/logger/`
- `backend/src/config/app.config.ts`
- `src/lib/api/client.ts`
- `src/lib/auth/AuthProvider.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/useful-maps/page.tsx`
- `src/components/UsefulMapsGallery.tsx`
- `src/components/UsefulMapsSidebar.tsx`

Specifically verify:

- Prisma naming, relations, migrations, and generation workflow.
- Explicit NestJS DTO `ValidationPipe` with `expectedType`.
- Auth, roles, current-user decorator, and access-token patterns.
- Mutation rate-limiting decorator.
- Cache versioning and invalidation convention.
- Correlation-aware structured logging convention.
- Backend environment validation convention.
- Frontend API-client envelope/error/refresh behavior.
- Explicit session restoration behavior.
- Existing public useful-maps viewer and sidebar behavior.
- Existing backend `node:test` and frontend Jest patterns.
