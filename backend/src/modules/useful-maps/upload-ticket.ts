import { createHmac, timingSafeEqual } from 'node:crypto';

export type UsefulMapUploadTicketClaims = {
  iss: string;
  aud: string;
  sub: string;
  role: 'ADMIN';
  pathnamePrefix: string;
  allowedContentTypes: readonly string[];
  maximumSizeInBytes: number;
  exp: number;
  iat: number;
  jti: string;
};

type VerifyOptions = {
  secret: string;
  expectedIssuer: string;
  expectedAudience: string;
  pathnamePrefix?: string;
};

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function signUsefulMapUploadTicket(
  claims: UsefulMapUploadTicketClaims,
  secret: string
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secret).update(signingInput).digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function verifyUsefulMapUploadTicket(
  token: string,
  options: VerifyOptions
): UsefulMapUploadTicketClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid useful maps upload ticket');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', options.secret).update(signingInput).digest();
  const actualSignature = base64UrlDecode(encodedSignature);

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Invalid useful maps upload ticket');
  }

  const payload = JSON.parse(
    base64UrlDecode(encodedPayload).toString('utf8')
  ) as UsefulMapUploadTicketClaims;

  if (payload.iss !== options.expectedIssuer) {
    throw new Error('Invalid useful maps upload ticket issuer');
  }

  if (payload.aud !== options.expectedAudience) {
    throw new Error('Invalid useful maps upload ticket audience');
  }

  if (payload.role !== 'ADMIN') {
    throw new Error('Invalid useful maps upload ticket role');
  }

  if (payload.exp * 1000 <= Date.now()) {
    throw new Error('Expired useful maps upload ticket');
  }

  if (options.pathnamePrefix && payload.pathnamePrefix !== options.pathnamePrefix) {
    throw new Error('Useful maps upload ticket pathname mismatch');
  }

  return payload;
}
