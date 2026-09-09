# Coach Patrik

Personal training website with a Next.js frontend and a NestJS backend.

## Prerequisites

- **Node.js 22 or higher** (see `.nvmrc` or `.node-version`)
- pnpm 10.10.0+ (specified in `package.json` packageManager)

## Stack

- Frontend: Next.js 16 (App Router), TypeScript, Tailwind v4
- Backend: NestJS 11 (`backend/`)
- Database: PostgreSQL via Prisma
- Package manager: pnpm workspace

## Run Locally

From repository root:

```bash
pnpm install
pnpm dev
pnpm dev:backend
```

Frontend runs on `http://localhost:3000`.
Backend runs on `http://localhost:3001`.

## Build

```bash
pnpm build
pnpm build:backend
```

## Test

```bash
pnpm test              # frontend (Jest)
pnpm test:backend      # backend (node:test)
```

## Important Rules

- Never store access tokens or refresh tokens in `localStorage`
- Backend is source of truth for authentication and user data
- Use exact package versions in `package.json`; do not use caret ranges like `^` for dependencies or devDependencies
