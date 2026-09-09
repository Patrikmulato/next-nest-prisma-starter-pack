---
description: Backend rules for backend/src/** files
globs: backend/src/**
---

- Test runner is **Node.js native (`node:test`)** — never use Jest; import `describe`/`it` from `node:test` and `assert` from `node:assert/strict`
- DTO validation uses class-validator decorators; `ValidationPipe` is configured with `whitelist: true, forbidNonWhitelisted: true` — unknown fields return 400
- Every controller that validates a request body must instantiate a local `ValidationPipe({ expectedType: DtoClass })` — the global pipe cannot infer `@Body()` metatype in this build
- CORS is configured in `app-setup.ts`; allowed origins are `localhost:3000`, `localhost:3001`, `CORS_ORIGIN` env var, and `FRONTEND_URL` env var
- Sensitive cookie-backed endpoints (`/api/auth/refresh`, `/api/auth/logout`) enforce an extra origin check in `auth.controller.ts`
- `POST /api/auth/logout` is intentionally not guarded by `JwtAuthGuard` — identity for revocation comes from the refresh cookie
- Never store refresh tokens in frontend-readable storage; they travel only via HttpOnly cookie
