# Full-Stack Starter — Copilot Instructions

## Requirements

- **Node.js 22+** (enforced via `package.json` engines, `.nvmrc`, `.node-version`)
- **pnpm 11.22.0** (pinned by the root `package.json` `packageManager` field)

## Project

A pnpm workspace with:

- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Backend: NestJS 11 API on port 3001 for authentication and user management

## Architecture

- `src/app/` — App Router pages. Landing page, auth pages, protected members area, admin user management.
- `src/components/` — React components. `Navbar.tsx` (auth-aware), `AuthForm.tsx` (reusable), `FilterDropdown.tsx` (generic dropdown).
- `src/lib/api/` — API wrappers for backend endpoints (auth, users).
- `src/lib/auth/AuthProvider.tsx` — frontend auth context using an in-memory access token plus HttpOnly refresh-cookie restore flow.
- `src/types/` — TypeScript contracts for auth and user API payloads.
- `backend/src/modules/auth/` — login/register/refresh/logout flow, JWT access tokens, HttpOnly refresh-token cookie, role checks.
- `backend/src/modules/users/` — admin-only user management.
- `backend/src/modules/health/` — liveness and readiness endpoints.

## Conventions

- Never store access tokens or refresh tokens in `localStorage` or other frontend-readable storage.
- Backend auth uses an HttpOnly refresh-token cookie.
- Use Tailwind utility classes. Dark theme is default.
- Path alias: `@/*` maps to `./src/*`.

## Commands

- Frontend dev: `pnpm dev`
- Backend dev: `pnpm dev:backend`
- Frontend build: `pnpm build`
- Backend build: `pnpm build:backend`
- Frontend tests: `pnpm test`
- Frontend tests with coverage: `pnpm test:coverage`
- Backend tests: `pnpm test:backend`
- Backend hardening checks: `pnpm --filter next-nest-prisma-starter-backend hardening:check`

## Git Hooks (Husky + lint-staged)

Automated quality checks at key git stages:

**Pre-Commit:** Frontend TypeScript check → ESLint and Prettier on staged files → related frontend Jest tests for staged `src/` files
**Commit Message:** Validates Conventional Commits format (e.g., `feat(scope): description`)
**Pre-Push:** Frontend lint, format check, coverage tests, build, and TypeScript check. Backend tests/build are not included in CI or the pre-push hook.

Fix any failures and re-stage before retrying.
