@AGENTS.md
@backend/CLAUDE.md

## Quick Reference

**Required:** Node.js 22+ (CI uses Node 24) and pnpm 11.22.0 (pinned in the root `package.json`)

- Next.js 16 App Router + TypeScript + Tailwind v4
- NestJS 11 backend in `backend/` — source of truth for auth and user management
- Key frontend components: `Navbar.tsx` (auth-aware nav), `AuthForm.tsx` (reusable form), `FilterDropdown.tsx` (generic dropdown)
- Auth: JWT access tokens (in-memory) + HttpOnly refresh cookie
- API routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/users`, `DELETE /api/users/:id`
- Build frontend: `pnpm build` | Dev frontend: `pnpm dev`
- Build backend: `pnpm build:backend` | Dev backend: `pnpm dev:backend`
- Frontend tests: `pnpm test` | Frontend tests with coverage: `pnpm test:coverage`
- Backend tests: `pnpm test:backend`
- **Pre-commit:** Frontend type check, staged-file ESLint/Prettier, and related frontend Jest tests
- **Commit messages:** Must follow Conventional Commits (e.g., `feat(scope): description`)
- **Pre-push:** Frontend lint, format check, coverage tests, build, and typecheck; backend tests/build are not included
