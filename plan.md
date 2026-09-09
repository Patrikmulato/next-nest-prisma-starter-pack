# Plan — Useful Map Categories admin CRUD

**Date:** 2026-08-10
**Goal:** Make `UsefulMapCategory` (currently only creatable via [seed.ts:6-19](backend/prisma/seed.ts#L6-L19)) manageable at runtime — create, edit, delete — through a new backend module and a new admin panel on `/dashboard` styled to match [UsefulMapsAdminPanel.tsx](src/components/UsefulMapsAdminPanel.tsx).

---

## Decisions (confirmed)

| Question         | Decision                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Module placement | New `UsefulMapCategoriesModule`; existing `useful-maps` module untouched except reuse    |
| Delete with maps | Block with **409 Conflict**, message includes map count (matches `onDelete: Restrict`)   |
| Editable fields  | **Label only** — slug immutable (blob pathnames embed `useful-maps/<slug>/…`)            |
| UI placement     | Separate `UsefulMapCategoriesAdminPanel` rendered **below** `UsefulMapsAdminPanel`       |
| Slug on create   | Auto-derived from label via `slugify()`, admin can override; backend validates format    |
| Panel sync       | `/dashboard` owns the category list and passes it + a refresh callback to both panels    |
| Ordering         | Alphabetical by label everywhere, sorted **in-service**, case-insensitive. No sort field |
| Uniqueness       | Case-insensitive on both slug and label                                                  |
| Seed             | Category seed **removed** — categories are created only through the new module           |

**No Prisma migration.** `UsefulMapCategory` already exists at [schema.prisma:66-73](backend/prisma/schema.prisma#L66-L73) with `slug @unique` and `label @unique`. Dropping the seed is not a data migration: existing databases keep their 12 rows, only fresh environments start empty.

---

## Architecture

```
GET    /api/useful-maps/categories        (public, unchanged)   ← existing, do not touch
GET    /api/useful-map-categories         (ADMIN) list + mapCount
POST   /api/useful-map-categories         (ADMIN) create { slug, label }
PUT    /api/useful-map-categories/:id     (ADMIN) update { label }
DELETE /api/useful-map-categories/:id     (ADMIN) delete, 409 if mapCount > 0
```

The new module imports `UsefulMapsModule` solely to call the already-exported
`UsefulMapsService.invalidatePublicCache()` ([useful-maps.service.ts:740](backend/src/modules/useful-maps/useful-maps.service.ts#L740)) after label edits and deletes — category labels are embedded in cached public map payloads, so a rename would otherwise serve stale labels for up to the cache TTL.

Rationale for a separate module: [useful-maps.service.ts](backend/src/modules/useful-maps/useful-maps.service.ts) is already 743 lines and owns blob lifecycle, upload tickets, and the cleanup queue. Categories are a distinct resource with no blob concerns.

---

## Task 1 — Backend module

New directory `backend/src/modules/useful-map-categories/`.

### 1a. DTOs

`dto/create-useful-map-category.dto.ts`

```ts
export class CreateUsefulMapCategoryDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;
}
```

The slug regex is copied verbatim from `ListPublicUsefulMapsQueryDto.categorySlug` ([list-public-useful-maps-query.dto.ts:16](backend/src/modules/useful-maps/dto/list-public-useful-maps-query.dto.ts#L16)) so the two stay consistent.

`dto/update-useful-map-category.dto.ts` — `label` only, same constraints, **not** optional (the only field, so an empty body is meaningless). No `slug` field: `whitelist: true, forbidNonWhitelisted: true` then makes a slug-change attempt a hard 400 rather than a silent no-op.

`dto/useful-map-category-admin.dto.ts` — extends the shape of the existing `UsefulMapCategoryDto` ([useful-map-category.dto.ts](backend/src/modules/useful-maps/dto/useful-map-category.dto.ts)) plus `mapCount!: number`. Also `UsefulMapCategoryMutationResponseDto { id: string; deleted: true }` mirroring the delete response shape used by useful-maps.

### 1b. Service — `useful-map-categories.service.ts`

Constructor injects `PrismaService`, `UsefulMapsService`, and `LoggerService` following the pattern in [useful-maps.service.ts:73-82](backend/src/modules/useful-maps/useful-maps.service.ts#L73-L82).

- `listCategories()` → `findMany({ include: { _count: { select: { usefulMaps: true } } } })` → map to admin DTO with `mapCount` → `sortCategoriesByLabel()` (see Ordering below).
- `createCategory(requesterUserId, dto)` → trim `label`; case-insensitive pre-check (below) → `ConflictException('A category with this slug or label already exists')`; then `create`. Also catch Prisma `P2002` and rethrow as the same `ConflictException` to close the race between check and write.
- `updateCategory(id, requesterUserId, dto)` → `findUnique` → `NotFoundException('Useful map category not found')`; trim label; if unchanged, return early without touching the cache; case-insensitive label conflict-check excluding `id`; `update`; then `await this.usefulMapsService.invalidatePublicCache()`.
- `deleteCategory(id, requesterUserId)` → `findUnique` with `_count`; if missing → 404; if `mapCount > 0` → `ConflictException(\`Cannot delete category with ${mapCount} attached useful map(s)\`)`; else `delete`+`invalidatePublicCache()`+ return`{ id, deleted: true }`.

Every mutation logs `{ requesterUserId, categoryId, action }` through the existing logger, matching how useful-maps logs admin mutations. No secrets or tokens in log payloads.

**Case-insensitive uniqueness.** Both create and update check with:

```ts
prisma.usefulMapCategory.findFirst({
  where: {
    id: excludeId ? { not: excludeId } : undefined,
    OR: [
      { slug: { equals: slug, mode: 'insensitive' } },
      { label: { equals: label, mode: 'insensitive' } },
    ],
  },
});
```

No schema change — the existing `@unique` indexes stay as the backstop for exact collisions and races. `slugify()` already lowercases, so the slug arm only matters for a hand-typed override.

### 1c. Controller — `useful-map-categories.controller.ts`

`@Controller('useful-map-categories')`. Every route carries `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`, `@Header('Cache-Control', 'private, no-store')`, and `@ApiResponseMessage(...)`.

Per [AGENTS.md](AGENTS.md#nestjs-dto-validation), each `@Body()` gets its own local pipe — the global pipe cannot infer the metatype in this build:

```ts
@Body(new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true, transform: true,
  expectedType: CreateUsefulMapCategoryDto,
}))
```

Rate limits: `@RateLimit(60, 60_000)` on the list route, `@RateLimit(30, 60_000)` on mutations.

### 1d. Module + registration

`useful-map-categories.module.ts` imports `AuthModule, PrismaModule, RateLimitModule, UsefulMapsModule`. Register it in [app.module.ts](backend/src/app.module.ts) alongside `UsefulMapsModule`.

---

## Task 2 — Alphabetical ordering, single-sourced

Categories are ordered alphabetically by label **everywhere in the app**. There is no sort-position field and none is added — display order is a pure function of the label.

Today this is incidental rather than guaranteed: [useful-maps.service.ts:623](backend/src/modules/useful-maps/useful-maps.service.ts#L623) delegates to Postgres `ORDER BY label ASC`, whose result depends on the database's collation and is case-sensitive under a `C` collation. Now that admins type labels freely, that becomes a real risk.

New `backend/src/common/utils/sort-by-label.ts`:

```ts
export function sortByLabel<T extends { label: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
}
```

Applied in exactly two places, which are the only sources of category lists:

1. `UsefulMapsService.listCategories()` — the public endpoint. Replace the `orderBy` with a `sortByLabel()` call on the result.
2. `UsefulMapCategoriesService.listCategories()` — the new admin endpoint.

Sorting in-process is safe here: the category set is small, unpaginated, and fully loaded in both cases. Ties are impossible because labels are unique case-insensitively (Task 1b).

**No frontend change.** [UsefulMapsBrowser.tsx:134-136](src/components/UsefulMapsBrowser.tsx#L134-L136) already renders the server order verbatim, prepending only the "All" pill, and the admin panels do the same. The rule is enforced server-side so no consumer has to remember it.

Unit test in `backend/src/common/utils/sort-by-label.test.ts`: mixed-case input sorts case-insensitively (`apple` before `Zebra`), and the input array is not mutated.

---

## Task 3 — Drop the category seed

[backend/prisma/seed.ts](backend/prisma/seed.ts) stops creating categories. Remove the `usefulMapCategorySeed` array ([lines 6-19](backend/prisma/seed.ts#L6-L19)) and its upsert loop ([lines 39-48](backend/prisma/seed.ts#L39-L48)). The country upsert loop stays — `seed.ts` remains a working script, just narrower.

This is **not** a data migration. Existing databases keep the 12 categories they already have; nothing is deleted. Only a fresh database starts with zero, where an admin creates categories through the new panel.

Nothing in the codebase depends on the seeded slugs — verified by grep. (`src/types/index.ts` has a `HintCategory` union containing `'license-plates'`, but that belongs to the unrelated hints feature and never reaches `UsefulMapCategory`.) The seed is not invoked in CI; the only reference is the command listed at [docs/HOW_IT_WORKS.md:400](docs/HOW_IT_WORKS.md#L400), which stays valid.

Two empty-state consequences to handle in the UI, both small:

- `UsefulMapsBrowser` renders only the "All" pill and its existing empty state. No change needed.
- `UsefulMapsAdminPanel`'s upload form would offer an empty category dropdown. Disable the submit button when `categories.length === 0` and show `Create a category below before uploading.` in place of the current generic error. Without this the admin gets a confusing "Title and category are required" on an empty fresh install.

---

## Task 4 — Backend tests

`node:test` + `node:assert/strict` only — **never Jest** in `backend/`. Template: [saved-filters.service.test.ts](backend/src/modules/saved-filters/saved-filters.service.test.ts) (mocked `PrismaService` / `CacheStore` cast through `as unknown as`).

`useful-map-categories.service.test.ts`:

1. `createCategory` trims label and persists the given slug
2. duplicate slug → `ConflictException`
3. duplicate label → `ConflictException`
4. label differing only in case (`bollards` vs `Bollards`) → `ConflictException`
5. Prisma `P2002` from `create` is surfaced as `ConflictException`, not a 500
6. `updateCategory` on a missing id → `NotFoundException`
7. `updateCategory` changes label and calls `invalidatePublicCache()` exactly once
8. `updateCategory` with an unchanged label does **not** invalidate the cache
9. `updateCategory` excludes the row's own id from the case-insensitive conflict check (changing `us` → `US` succeeds)
10. `deleteCategory` with `mapCount > 0` → `ConflictException`, and `prisma.delete` is never called
11. `deleteCategory` with no maps → deletes and invalidates cache
12. `listCategories` maps `_count.usefulMaps` onto `mapCount` and returns them label-sorted

`useful-map-categories.controller.e2e.test.ts` — Supertest, modelled on [users.controller.e2e.test.ts](backend/src/modules/users/users.controller.e2e.test.ts):

1. no Bearer token → 401
2. authenticated non-admin → 403
3. `POST` with `slug: 'Not A Slug'` → 400
4. `POST` with an unknown extra field → 400 (`forbidNonWhitelisted`)
5. `PUT` carrying `slug` → 400 (slug is immutable, enforced by whitelisting)

---

## Task 5 — Frontend types + API wrapper

`src/types/useful-maps.ts` — append:

```ts
export interface UsefulMapCategoryAdmin extends UsefulMapCategory {
  mapCount: number;
}
export interface CreateUsefulMapCategoryPayload {
  slug: string;
  label: string;
}
export interface UpdateUsefulMapCategoryPayload {
  label: string;
}
```

New `src/lib/api/useful-map-categories.ts` using the shared `apiClient` (never `fetch` directly):
`listAdminUsefulMapCategories()`, `createUsefulMapCategory()`, `updateUsefulMapCategory(id, payload)`, `deleteUsefulMapCategory(id)`.

Extract the existing `slugify()` from [UsefulMapsAdminPanel.tsx:19-25](src/components/UsefulMapsAdminPanel.tsx#L19-L25) into `src/lib/slugify.ts` and import it in both panels rather than duplicating it. This is the only change to existing shared code, and it is required by the auto-derive decision.

---

## Task 6 — `UsefulMapCategoriesAdminPanel.tsx`

New client component, styling copied from `UsefulMapsAdminPanel`: `section.mt-8.rounded-2xl.border.border-zinc-800.bg-[#12161b].p-4`, header row with `h2.text-lg.font-semibold.text-white` + `p.text-sm.text-zinc-400` subtitle and a Refresh button, red `error` line, emerald `statusMessage` line, then the table in `overflow-x-auto.rounded-xl.border.border-zinc-800` with a `bg-[#20262e]` uppercase header.

**Create form** — `grid gap-3 md:grid-cols-3`: Label input, Slug input, submit button (`bg-blue-600`). Typing in Label sets Slug via `slugify()` **only while the admin hasn't manually edited the slug field** (tracked by a `slugTouched` flag), so an override is never clobbered.

**Table** — columns: Label, Slug, Maps (`mapCount`), Actions. Inline editing mirrors the maps panel: `editingId` + `editDraft` state, row swaps the label cell for an input and Actions for Save/Cancel.

- Slug cell renders as static `text-zinc-500` text even while editing, with `title="Slug cannot be changed"` — the immutability is visible, not just enforced server-side.
- Delete uses `window.confirm`, matching [UsefulMapsAdminPanel.tsx:252](src/components/UsefulMapsAdminPanel.tsx#L252). The Delete button is `disabled` when `mapCount > 0` with `title` explaining why, so the 409 is normally unreachable from the UI — but the 409 is still surfaced as an error message if it happens (stale list).
- Empty state: `<p className="text-sm text-zinc-500">No categories yet. Create one above to start uploading maps.</p>` — reachable on any fresh install now that the seed is gone (Task 3), so it carries the next action rather than just stating the fact.

No pagination and no client-side sorting — the list arrives label-sorted from the server (Task 2) and is rendered in that order. The set is small and admin-curated.

---

## Task 7 — Wire into `/dashboard` with shared state

[src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) gains `categories: UsefulMapCategoryAdmin[]` state plus a `refreshCategories()` callback, loaded in the existing admin-gated effect alongside `listUsers()`.

- `<UsefulMapsAdminPanel categories={categories} onCategoriesStale={refreshCategories} />`
- `<UsefulMapCategoriesAdminPanel categories={categories} onChanged={refreshCategories} />`

`UsefulMapsAdminPanel` changes, and nothing else in it moves:

1. Drop the two internal `listUsefulMapCategories()` calls ([lines 72-76](src/components/UsefulMapsAdminPanel.tsx#L72-L76) and [92-101](src/components/UsefulMapsAdminPanel.tsx#L92-L101)) and the `categories` state, reading the prop instead.
2. Disable the upload submit and show `Create a category below before uploading.` when `categories.length === 0` (Task 3).

Its map create/edit/delete logic is untouched.

Side benefit worth noting: today `refreshFirstPage()` reloads categories with `onlyWithImages: true` while the initial load uses no filter, so after the first upload the dropdown silently loses every empty category — including any freshly created one. Sourcing from the admin list (always all categories) removes that inconsistency.

---

## Task 8 — Frontend test

`src/components/__tests__/UsefulMapCategoriesAdminPanel.test.tsx` (Jest + Testing Library, per frontend convention — Jest is frontend-only), mocking `@/lib/api/useful-map-categories`:

1. renders rows for the supplied categories including `mapCount`
2. typing a label auto-fills the slug, and a manual slug edit survives further label typing
3. submitting calls `createUsefulMapCategory` with the trimmed label and derived slug, then calls `onChanged`
4. Delete is disabled for a category with `mapCount > 0`
5. the empty state renders when `categories` is `[]`

Extend the existing [page.test.tsx](src/app/__tests__/page.test.tsx)-style coverage with one case in a `UsefulMapsAdminPanel` test: the upload button is disabled and the create-a-category hint shows when `categories` is empty.

---

## Task 9 — Docs

Add the four new routes to the endpoint table in [backend/CLAUDE.md](backend/CLAUDE.md) and the module to its directory listing, plus three rules:

- Category slugs are immutable after creation because blob pathnames embed them.
- Categories are always ordered alphabetically by label, sorted server-side via `sortByLabel()`; there is no sort-position field.
- Categories are created only through `/api/useful-map-categories` — `prisma/seed.ts` no longer seeds them, so a fresh database starts with none.

Update [docs/HOW_IT_WORKS.md:400](docs/HOW_IT_WORKS.md#L400) to note that `prisma:seed` now covers countries only.

---

## Verification

Run in order; do not claim success without the actual output.

```
pnpm --filter geoguessr-helper-backend test          # node:test suites
pnpm build:backend                                   # backend typecheck/build
pnpm test                                            # frontend Jest
pnpm lint && pnpm build                              # frontend lint + build
```

Manual smoke on `/dashboard` as an ADMIN:

1. Create a category → it appears immediately in the Useful Maps upload dropdown, in alphabetical position.
2. Rename it → the public gallery shows the new label (cache invalidation) and the pill order updates.
3. Try creating a category whose label differs only in case from an existing one → 409 surfaced as an error message.
4. Try deleting a category that has maps → the button is disabled; delete an empty one → succeeds.
5. `pnpm --filter geoguessr-helper-backend prisma:seed` against a scratch database → countries are seeded, categories table stays empty, and the admin panel shows its empty state.

---

## Out of scope

- A sort-position field. Ordering is alphabetical by label everywhere and is not user-configurable (Task 2).
- Reassigning maps between categories as part of delete (rejected in favour of 409).
- Changing the public `GET /api/useful-maps/categories` response contract or the public gallery UI. Task 2 changes only the ordering guarantee behind that endpoint, not its shape.
- Any Prisma migration or schema change.
- Backfilling or removing the 12 categories already present in existing databases. Task 3 stops seeding going forward; it does not touch existing rows.
