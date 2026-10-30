import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ValidationExceptionFilter } from './common/filters/validation.exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { getAppConfig } from './config/app.config.js';
import { setupSwagger } from './swagger.config.js';

// Pure CORS origin check (exported for tests). A missing origin (curl,
// same-origin server calls, mobile apps) is permitted; otherwise the origin must
// be explicitly allow-listed.
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[]
): boolean {
  if (!origin) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

type SetupOptions = {
  withGlobalPrefix?: boolean;
};

export function setupApp(app: NestFastifyApplication, options: SetupOptions = {}): void {
  const { withGlobalPrefix = true } = options;
  const appConfig = getAppConfig();

  // Type assertion: @fastify/cookie v11 types FastifyCookie with extra utility
  // methods that cause TypeScript plugin assignability failures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.register(fastifyCookie as any);

  // Build allowed origins from local development and explicit environment config.
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    appConfig.corsOrigin,
    appConfig.frontendUrl,
  ].filter((origin): origin is string => Boolean(origin));

  // CORS configuration with explicit origin allowlisting.
  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Deny (do not error) on disallowed origins: erroring would surface as a
      // 500 before route handlers run. Denying simply omits CORS headers, and
      // sensitive endpoints enforce their own origin check for a clean 403.
      callback(null, isOriginAllowed(origin, allowedOrigins));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };

  // Type assertion: Fastify CORS types are strict about origin function signature,
  // but our implementation works correctly at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.enableCors(corsOptions as any);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Register global filters (exception handling)
  app.useGlobalFilters(new ValidationExceptionFilter(), new HttpExceptionFilter());

  // Register global interceptors (response standardization)
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (withGlobalPrefix) {
    app.setGlobalPrefix('api');
  }

  // API docs at /api/docs (Swagger UI + OpenAPI JSON).
  setupSwagger(app);
}
