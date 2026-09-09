# Coach Patrik — Backend

NestJS 11 REST API serving authentication and user management.
Runs on port 3001 locally; deployed as Vercel serverless via `api/index.ts`.

## Tech Stack

- NestJS 11 (Fastify adapter)
- class-validator + class-transformer (DTO validation with `ValidationPipe`)
- tsx (TypeScript executor for scripts and tests)
- **Node.js native test runner (`node:test`) — not Jest**

## API Endpoints

| Method | Path                 | Purpose                                                 |
| ------ | -------------------- | ------------------------------------------------------- |
| POST   | `/api/auth/register` | Create account, return access token, set refresh cookie |
| POST   | `/api/auth/login`    | Authenticate, return access token, set refresh cookie   |
| POST   | `/api/auth/refresh`  | Rotate session via HttpOnly refresh cookie              |
| POST   | `/api/auth/logout`   | Clear refresh cookie and revoke current refresh session |
| GET    | `/api/auth/me`       | Return current user from Bearer access token            |
| GET    | `/api/users`         | (ADMIN) List all users                                  |
| GET    | `/api/users/:id`     | (ADMIN) Get user by ID                                  |
| POST   | `/api/users`         | (ADMIN) Create a user                                   |
| DELETE | `/api/users/:id`     | (ADMIN) Delete a user                                   |
| GET    | `/api/health`        | Liveness check                                          |
| GET    | `/api/health/ready`  | Readiness check with database verification              |

## Directory Structure

```
src/
  main.ts                        # Entry point, port 3001
  app-setup.ts                   # CORS + global ValidationPipe config
  swagger.config.ts              # Swagger UI setup (at /api/docs)
  app.module.ts                  # Registers modules + global rate limit guard
  common/
    cache/                       # Optional Upstash-backed cache store
    rate-limit/                  # Global rate limiting + outage policy handling
    logger/                      # Structured logs + correlation ids
  modules/auth/
    auth.controller.ts           # register/login/refresh/logout/me
    auth.service.ts              # token issuance, rotation, revocation
    jwt-auth.guard.ts            # Bearer access-token guard
  modules/health/
    health.controller.ts         # liveness + readiness
  modules/users/
    users.controller.ts          # admin CRUD endpoints
    users.service.ts             # business logic
  modules/prisma/
    prisma.service.ts            # database client
prisma/
  schema.prisma                  # User model
  migrations/                    # Applied migrations
api/
  index.ts                       # Vercel serverless handler
```

## Database

PostgreSQL via Prisma. Single `User` model:

- `id` (cuid), `email` (unique), `passwordHash`, `role` (USER | ADMIN), `refreshTokenHash`

## Testing

Uses Node.js native test runner (`node:test`), not Jest.

```
pnpm --filter coach-patrik-backend test
pnpm --filter coach-patrik-backend hardening:check
```

## CORS

Configured in `app-setup.ts` and `auth.controller.ts`.

- Allows `http://localhost:3000`, `http://localhost:3001`, `CORS_ORIGIN` env var, `FRONTEND_URL` env var.
- Also allows this project's Vercel preview-origin pattern (`coach-patrik-*`) only.
- Sensitive cookie-backed auth endpoints (`refresh`, `logout`) additionally enforce an allowed `Origin` check in the controller.

## Auth

- Refresh tokens are transported in an HttpOnly cookie (`refresh_token`), not in JSON response bodies and not in frontend-readable storage.
- Access tokens are returned in the response body and used as Bearer tokens.
- `POST /api/auth/logout` is intentionally not guarded by `JwtAuthGuard`; it clears the refresh cookie and revokes the current refresh session via the cookie token.
- `ADMIN_EMAILS` env var: comma-separated emails that receive ADMIN role on register or next login.

## Shared Store Policy

- Upstash Redis is optional.
- `CACHE_OUTAGE_POLICY` and `RATE_LIMIT_OUTAGE_POLICY` control `fail-open` vs `fail-closed` behavior.
- With `fail-open`, missing/unavailable Upstash falls back to per-instance memory.
- With `fail-closed`, affected operations error instead.

## Environment Variables

| Variable                   | Required | Description                              |
| -------------------------- | -------- | ---------------------------------------- |
| `DATABASE_URL`             | ✓ prod   | PostgreSQL connection string             |
| `JWT_SECRET`               | ✓ prod   | Secret for signing access tokens         |
| `JWT_REFRESH_SECRET`       | ✓ prod   | Secret for signing refresh tokens        |
| `PORT`                     |          | Port to listen on (default: 3001)        |
| `NODE_ENV`                 |          | `development` or `production`            |
| `CORS_ORIGIN`              |          | Allowed frontend origin                  |
| `FRONTEND_URL`             |          | Allowed frontend URL                     |
| `ADMIN_EMAILS`             |          | Comma-separated emails promoted to ADMIN |
| `UPSTASH_REDIS_REST_URL`   |          | Optional shared store URL                |
| `UPSTASH_REDIS_REST_TOKEN` |          | Optional shared store token              |
| `CACHE_OUTAGE_POLICY`      |          | `fail-open` (default) or `fail-closed`   |
| `RATE_LIMIT_OUTAGE_POLICY` |          | `fail-open` (default) or `fail-closed`   |

## NestJS DTO Validation Note

This build cannot rely on reflected `@Body()` metatype inference for the global `ValidationPipe`. Every controller that validates a request body must instantiate a local `ValidationPipe({ expectedType: DtoClass })`. See `auth.controller.ts` and `users.controller.ts` for the existing pattern.

## Do NOT

- Write tests using Jest — use `node:test` and `assert` from the standard library
- Import from `dist/` — use `tsx` for all script execution
- Store refresh tokens in frontend-readable storage
- Add validation without class-validator decorators in the DTO
