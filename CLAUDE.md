@AGENTS.md
@backend/CLAUDE.md

## Quick Reference

**Required:** Node.js 22+ (see `.nvmrc`, `.node-version`, or `package.json` engines field)

- Next.js 16 App Router + TypeScript + Tailwind v4
- NestJS 11 backend in `backend/` — source of truth for auth and user management
- Key frontend components: `Navbar.tsx` (auth-aware nav), `AuthForm.tsx` (reusable form), `FilterDropdown.tsx` (generic dropdown)
- Auth: JWT access tokens (in-memory) + HttpOnly refresh cookie
- API routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/users`, `DELETE /api/users/:id`
- Build frontend: `pnpm build` | Dev frontend: `pnpm dev`
- Build backend: `pnpm build:backend` | Dev backend: `pnpm dev:backend`
- Frontend tests: `pnpm test` | Frontend tests with coverage: `pnpm test:coverage`
- Backend tests: `pnpm test:backend`
- **Pre-commit:** Type checking → ESLint → Prettier → Jest tests
- **Commit messages:** Must follow Conventional Commits (e.g., `feat(scope): description`)
- **Pre-push:** Full type checking + all tests + frontend build validation
