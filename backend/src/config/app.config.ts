export type AppConfig = {
  port: number;
  nodeEnv: string;
  corsOrigin?: string;
  frontendUrl?: string;
  adminEmails: ReadonlySet<string>;
  cacheOutagePolicy: OutagePolicy;
  rateLimitOutagePolicy: OutagePolicy;
};

export type OutagePolicy = 'fail-closed' | 'fail-open';

function requireProductionEnvVar(name: string): void {
  if (!process.env[name]) {
    throw new Error(`${name} is required in production`);
  }
}

function parseAdminEmails(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseOutagePolicy(value: string | undefined, fallback: OutagePolicy): OutagePolicy {
  if (!value) {
    return fallback;
  }

  if (value === 'fail-closed' || value === 'fail-open') {
    return value;
  }

  throw new Error(`Invalid outage policy \"${value}\". Use \"fail-closed\" or \"fail-open\".`);
}

export function getAppConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const port = Number(process.env.PORT ?? '3001');

  if (Number.isNaN(port) || port <= 0) {
    throw new Error('PORT must be a positive number');
  }

  if (nodeEnv === 'production') {
    requireProductionEnvVar('DATABASE_URL');
    requireProductionEnvVar('JWT_SECRET');
    requireProductionEnvVar('JWT_REFRESH_SECRET');
    // Upstash is optional in production: when it is not configured, the shared
    // stores fall back to per-instance memory according to the outage policy
    // (fail-open by default). Set *_OUTAGE_POLICY=fail-closed to require it.
  }

  return {
    port,
    nodeEnv,
    corsOrigin: process.env.CORS_ORIGIN,
    frontendUrl: process.env.FRONTEND_URL,
    adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS),
    cacheOutagePolicy: parseOutagePolicy(process.env.CACHE_OUTAGE_POLICY, 'fail-open'),
    rateLimitOutagePolicy: parseOutagePolicy(process.env.RATE_LIMIT_OUTAGE_POLICY, 'fail-open'),
  };
}
