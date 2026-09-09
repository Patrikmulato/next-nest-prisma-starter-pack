export const ACCESS_TOKEN_EXPIRES_IN = '1h';
export const REFRESH_TOKEN_EXPIRES_IN = '7d';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

// The frontend and backend are deployed as separate Vercel projects on
// different registrable domains, so the refresh cookie is cross-site from the
// browser's perspective. Cookies with SameSite=Lax are never sent on
// cross-site fetch/XHR (only top-level navigation), so a Lax cookie here would
// silently fail to round-trip on every /api/auth/refresh call once deployed,
// logging users out whenever the short-lived access token expires. Detect
// this via VERCEL_URL (auto-populated by Vercel, no manual config needed)
// rather than hardcoding it, so local dev — where frontend and backend share
// the "localhost" site — keeps the stricter Lax behavior.
function isCrossSiteDeployment(): boolean {
  const frontendUrl = process.env.FRONTEND_URL;
  const backendHost = process.env.VERCEL_URL;

  if (!frontendUrl || !backendHost) {
    return false;
  }

  try {
    return new URL(frontendUrl).hostname !== backendHost;
  } catch {
    return false;
  }
}

export function getRefreshTokenCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  const secure = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    // SameSite=None requires Secure; only relax to 'none' when we're actually
    // both cross-site and able to set Secure, otherwise the browser drops the
    // cookie entirely.
    sameSite: secure && isCrossSiteDeployment() ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function resolveAccessTokenSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-secret';
  }

  return resolveInsecureDevSecret('JWT_SECRET', 'dev-jwt-secret-change-me');
}

export function resolveRefreshTokenSecret(): string {
  if (process.env.JWT_REFRESH_SECRET) {
    return process.env.JWT_REFRESH_SECRET;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test-jwt-refresh-secret';
  }

  return resolveInsecureDevSecret('JWT_REFRESH_SECRET', 'dev-jwt-refresh-secret-change-me');
}

// Only fall back to a well-known development secret in local development. Any
// other environment (staging, preview, production, ...) must supply a real
// secret; otherwise tokens could be forged with a publicly-known key.
function resolveInsecureDevSecret(envVarName: string, fallback: string): string {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development') {
    throw new Error(
      `${envVarName} must be set when NODE_ENV is "${nodeEnv}"; refusing to use the insecure development fallback.`
    );
  }

  console.warn(
    `[auth] ${envVarName} is not set — using an insecure development fallback. Do not use this outside local development.`
  );
  return fallback;
}
