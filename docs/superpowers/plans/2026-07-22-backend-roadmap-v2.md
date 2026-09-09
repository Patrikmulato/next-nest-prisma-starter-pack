# GeoHelper Backend Fejlesztesi Roadmap (v2)

Source: user-provided roadmap (2026-07-22), normalized into repo docs for portability.

## Jelenlegi helyzet

- NestJS 11 + Fastify backend
- 3 API endpoint: `/api/data/geojson`, `/api/data/map`, `/api/data/filter`
- ValidationPipe + CORS middleware
- Unit + E2E testing
- Deployment: Vercel serverless
- Hianyzik: Auth, Logging/Observability, full CRUD modules, Rate limiting, Redis cache

## Deployment strategy

- Week 1-7: stay on Vercel (code-first focus)
- Week 8: harden backend for Vercel serverless production runtime
- Motivation: keep hosting free for hobby usage, reduce migration overhead, and prepare for serverless constraints (cold starts, pooled DB access, stateless runtime)

## Fazisok (10 hetes terv)

| Het | Fazis    | Fokusz                                               | Deliverable            |
| --- | -------- | ---------------------------------------------------- | ---------------------- |
| 1   | Fazis 1  | NestJS structure + DTO + validation + error handling | Foundation complete    |
| 2   | Fazis 2  | PostgreSQL + Prisma + migrations                     | DB foundation complete |
| 3   | Fazis 3  | Logging + correlation IDs                            | Observability baseline |
| 4   | Fazis 4  | Users + SavedFilters CRUD                            | Persistence features   |
| 5   | Fazis 5  | Auth (register/login/JWT/hash)                       | Authentication         |
| 6   | Fazis 6  | Guards + RBAC + ownership                            | Authorization          |
| 7   | Fazis 7  | Unit + E2E hardening                                 | 80%+ coverage          |
| 8   | Fazis 8  | Vercel serverless hardening                          | Production runtime     |
| 9   | Fazis 9  | External cache + rate limiting                       | Performance/security   |
| 10  | Fazis 10 | Polish + docs + frontend integration                 | Launch-ready           |

## Fazis 1 scope

- Maintain modular backend structure under `backend/src/modules/**`
- Global validation and standardized response/error formatting
- Health module + endpoint (`/api/health`)
- Common error and response handling:
  - `common/filters/http-exception.filter.ts`
  - `common/interceptors/response.interceptor.ts`
- Optional extras listed in roadmap:
  - `validation.exception.filter.ts`
  - `common/decorators/api-response.decorator.ts`
  - `config/app.config.ts`
  - `modules/data/dto/filter-response.dto.ts`

## Fazis 2 scope

- Prisma schema + migrations + generated client
- Database config and runtime Prisma integration
- Seed workflow for initial country data
- Target models and relations:
  - `Country`, `User`, `SavedFilter`, `FilterHistory`, enum role
- Intended relation behavior (roadmap): cascade ownership relationships for user-owned entities

## Fazis 3 scope (next)

- Structured JSON logging
- Correlation ID middleware and propagation
- Logger module/service wrappers and log decorators
- Request tracing by correlation ID

## Fazis 8 hardening note (Vercel serverless)

When staying on Vercel serverless runtime:

1. Keep the serverless handler (`backend/api/index.ts`) as the deployment entrypoint
2. Configure Vercel function limits/behavior in `backend/vercel.json`
3. Ensure production secrets are present (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`)
4. Use a pooled PostgreSQL connection string for Prisma in serverless traffic patterns
5. Keep health endpoint for runtime checks (`/api/health`)

## Weekly checklist

- [ ] Week 1 complete
- [ ] Week 2 complete
- [ ] Week 3 complete
- [ ] Week 4 complete
- [ ] Week 5 complete
- [ ] Week 6 complete
- [ ] Week 7 complete
- [ ] Week 8 complete
- [ ] Week 9 complete
- [ ] Week 10 complete

## References

- NestJS docs: https://docs.nestjs.com
- Prisma docs: https://www.prisma.io/docs
- Vercel docs: https://vercel.com/docs
- Upstash docs: https://upstash.com/docs
