# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Before changing Next.js application code, routing, caching, rendering behavior, middleware, metadata, image handling, request APIs, or configuration:

1. Inspect the relevant existing implementation in this repository.
2. Read the applicable guide in `node_modules/next/dist/docs/` before writing any code.
3. Heed deprecation notices and follow repository conventions.
4. Do not introduce legacy Pages Router patterns or deprecated APIs.

# Coach Patrik — Agent Instructions

## Project Overview

A personal training website for Patrik. Clients can register, log in, and access a protected members area. Admins can manage users. The NestJS backend is the source of truth for authentication and user data — it must remain authoritative.

## Instruction Priority

Apply repository instructions in this order:

1. The current user request.
2. An approved task-specific spec or plan (e.g. under `docs/`).
3. This `AGENTS.md` and `CLAUDE.md`.
4. Directory-local docs, config, and nearby tests (e.g. `backend/CLAUDE.md`, `.claude/rules/`).

If instructions conflict or the required behavior is ambiguous, stop and ask for clarification rather than silently picking an interpretation.

## Requirements

- **Node.js 22+** (`.nvmrc`, `.node-version`, `package.json` engines)
- pnpm 10.10.0+

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Backend:** NestJS 11 API in `backend/`
- **Database:** PostgreSQL via Prisma (`backend/prisma/schema.prisma`)
- **Package manager:** pnpm workspace
- **Path alias:** `@/*` → `./src/*`

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
    layout.tsx      # Root layout — wraps all pages with Navbar and AuthProvider
    page.tsx        # Landing page — hero, about, services, contact sections
    globals.css     # Global styles
    login/page.tsx          # Login page
    register/page.tsx       # Register page
    members/page.tsx        # Protected members area (requires authentication)
    members/[slug]/page.tsx # Protected member content pages
    admin/users/page.tsx    # Admin-only user management
  components/       # Reusable React components
    Navbar.tsx          # Auth-aware navigation bar
    AuthForm.tsx        # Reusable login/register form
    FilterDropdown.tsx  # Generic viewport-aware dropdown
  config/           # App configuration (API base URL, env vars)
  lib/
    api/            # API client + typed API wrappers (auth, users)
    auth/           # Auth context (AuthProvider) — access token + refresh cookie
  types/            # TypeScript contracts for API payloads
backend/
  prisma/           # Prisma schema and migrations
  src/
    modules/        # NestJS feature modules: auth, health, users, prisma
    common/         # Shared infra: cache, rate-limit, logger
  # see backend/CLAUDE.md for the full directory breakdown
.claude/
  rules/            # Context-aware agent rules loaded by file glob
  settings.json     # Pre-allowed commands + hooks
```

## Commands

| Command                                              | Purpose                          |
| ---------------------------------------------------- | -------------------------------- |
| `pnpm dev`                                           | Start Next.js dev server         |
| `pnpm dev:backend`                                   | Start NestJS backend             |
| `pnpm build`                                         | Build frontend                   |
| `pnpm build:backend`                                 | Build backend                    |
| `pnpm test`                                          | Run frontend tests               |
| `pnpm test:coverage`                                 | Run frontend tests with coverage |
| `pnpm test:backend`                                  | Run backend tests                |
| `pnpm --filter coach-patrik-backend hardening:check` | Run backend hardening checks     |

## CI/CD

The project uses GitHub Actions for continuous integration. The CI workflow (`.github/workflows/ci.yml`) runs on pull requests and pushes to main, performing:

- Dependency installation
- Frontend linting and format checking
- TypeScript type checking (frontend)
- Frontend testing with coverage reporting
- Frontend build
- Coverage upload to Codecov
- Deployment to Vercel (on push to main)

All checks must pass for the build to deploy.

## Git Hooks (Husky)

The project uses Husky to enforce code quality, formatting, and testing at key git stages:

### Pre-Commit Hook

Runs on every commit attempt:

1. **TypeScript type checking** on `.ts`/`.tsx` files (`tsc --noEmit`)
2. **ESLint** auto-fixes style issues on changed code
3. **Prettier** formats code and JSON/CSS/Markdown files
4. **Jest** runs related tests in `--bail` mode (stops on first failure)

If any check fails, fix the issues and re-stage before retrying the commit.

### Commit Message Hook

Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

Example: feat(members): add training guide content page
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`

### Pre-Push Hook

Runs before pushing to remote:

1. Type checking for frontend and backend
2. Full test suite (not just related tests)
3. Frontend build validation

Prevents pushing code that doesn't compile or has failing tests.

### Bypass Hooks (Not Recommended)

- Commit only: `git commit --no-verify`
- Push only: `git push --no-verify`

## Change Discipline

- Inspect existing code, nearby tests, and relevant docs before changing an area; reuse established patterns for DTOs, validation, error handling, logging, caching, API responses, auth, and config.
- Keep diffs minimal and focused on the requested task. Do not refactor unrelated code while implementing a feature or fix.
- Preserve public API and UI behavior unless a change is explicitly required.
- Do not add, remove, or upgrade dependencies, or change lockfiles, env files, build settings, CI/CD, or deployment config, without explicit approval.

## NestJS DTO Validation

This build cannot rely on reflected `@Body()` metatype inference for the global `ValidationPipe` (see the `// The global ValidationPipe can't infer the @Body() metatype in this build` comments in `auth.controller.ts` and `users.controller.ts`). Every controller that validates a request DTO must instantiate a local `ValidationPipe` and pass the DTO class explicitly (`new ValidationPipe({ ... })` with the expected type) rather than assuming the global pipe infers it. Reuse this existing pattern instead of inventing a new one.

## Security, Database, and External Side Effects

- Never expose, print, commit, or log secrets, credentials, tokens, JWTs, cookies, API keys, or full request headers. Never place server-only secrets in browser code or `NEXT_PUBLIC_*` env vars.
- Preserve authorization, ownership checks, input validation, and rate limiting when modifying protected functionality — do not weaken a security check to make a feature work.
- Ask before running migrations, seeders, or destructive database commands, and before any command that contacts non-local services or mutates external infrastructure. Never run production migrations/deletes/deployments without explicit approval.

## Validation and Completion Standard

- Use existing package scripts, CI config, and nearby tests as the source of truth for validation commands; run the narrowest relevant check first, then broader checks (lint, typecheck, tests, build) when the change warrants it.
- Do not state that a test, build, lint, or manual check passed unless it was actually run and the result is known. If validation can't be run, say what was skipped and why.

## Key Conventions

1. **Backend-owned auth/user data** — API is source of truth for authentication and user management.
2. **Protected routes** — Members area redirects to `/login` when unauthenticated; admin pages also redirect to `/` for non-admin users.
3. **Auth pattern** — Access token in-memory in `AuthProvider`; refresh token in HttpOnly cookie. Never store tokens in `localStorage`.
4. **Frontend responsibilities** — UI state, page rendering, and API orchestration only.
5. **Styling** — Use Tailwind utility classes. Dark theme is the default. Custom CSS goes in `globals.css` only when Tailwind can't cover it.

## Do NOT

- Store access tokens or refresh tokens in `localStorage` or other frontend-readable storage
- Bypass the backend for user data (frontend should call API wrappers in `src/lib/api/`)
- Commit, push, create branches, amend history, rebase, reset, stash, or discard changes unless explicitly asked
- Create, apply, or modify database migrations without explicit approval
