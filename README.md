# next-nest-prisma-starter-pack

Boilerplate for a full-stack web app with a Next.js frontend, NestJS backend, and Prisma database layer.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** NestJS 11 in `backend/`, Fastify adapter
- **Database:** PostgreSQL via Prisma (`backend/prisma/schema.prisma`)
- **Auth:** JWT access tokens (in-memory) + HttpOnly refresh cookie
- **Package manager:** pnpm workspace

## Prerequisites

- Node.js 22+ (see `.nvmrc` or `.node-version`)
- pnpm 10.10.0+ (set in `package.json` `packageManager`)

## Run Locally

```bash
pnpm install
pnpm dev          # Next.js on http://localhost:3000
pnpm dev:backend  # NestJS on http://localhost:3001
```

## Common Commands

| Command                  | Purpose                        |
| ------------------------ | ------------------------------ |
| `pnpm dev`               | Start Next.js dev server       |
| `pnpm dev:backend`       | Start NestJS backend           |
| `pnpm build`             | Build frontend                 |
| `pnpm build:backend`     | Build backend                  |
| `pnpm test`              | Run frontend tests             |
| `pnpm test:coverage`     | Frontend tests with coverage   |
| `pnpm test:backend`      | Run backend tests              |
| `pnpm lint`              | Lint frontend                  |
| `pnpm format`            | Format all files with Prettier |
| `pnpm format:check`      | Check formatting without write |
| `pnpm typecheck`         | TypeScript type check          |

## Auth Endpoints

| Method | Path                   | Purpose                                        |
| ------ | ---------------------- | ---------------------------------------------- |
| POST   | `/api/auth/register`   | Create account, return access token            |
| POST   | `/api/auth/login`      | Authenticate, return access token              |
| POST   | `/api/auth/refresh`    | Rotate session via HttpOnly refresh cookie     |
| POST   | `/api/auth/logout`     | Clear refresh cookie and revoke session        |
| GET    | `/api/auth/me`         | Return current user from Bearer token          |
| GET    | `/api/users`           | (Admin) List all users                         |
| DELETE | `/api/users/:id`       | (Admin) Delete a user                          |
| GET    | `/api/health`          | Liveness check                                 |
| GET    | `/api/health/ready`    | Readiness check with database verification     |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
DATABASE_URL=          # PostgreSQL connection string
JWT_SECRET=            # Secret for signing access tokens
JWT_REFRESH_SECRET=    # Secret for signing refresh tokens
ADMIN_EMAILS=          # Comma-separated emails promoted to ADMIN role
```

## Git Hooks

Husky runs on commit and push:

- **Pre-commit:** type check → lint → format → related tests
- **Commit message:** must follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): description`)
- **Pre-push:** full type check + all tests + frontend build
