export type UsefulMapsConfig = {
  publicCacheTtlSeconds: number;
  publicPageSizeMax: number;
  blobPathPrefix: string;
  allowedUploadMimeTypes: readonly string[];
  uploadTicketSecret: string;
  uploadTicketIssuer: string;
  uploadTicketAudience: string;
  maxUploadBytes: number;
  allowedBlobHosts: readonly string[];
};

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseCsvList(value: string | undefined, fallback: readonly string[]): readonly string[] {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

export function getUsefulMapsConfig(): UsefulMapsConfig {
  const uploadTicketSecret = process.env.USEFUL_MAPS_UPLOAD_TICKET_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && !uploadTicketSecret) {
    throw new Error('USEFUL_MAPS_UPLOAD_TICKET_SECRET is required in production');
  }

  return {
    publicCacheTtlSeconds: parsePositiveInteger(
      process.env.USEFUL_MAPS_PUBLIC_CACHE_TTL_SECONDS,
      120,
      'USEFUL_MAPS_PUBLIC_CACHE_TTL_SECONDS'
    ),
    publicPageSizeMax: parsePositiveInteger(
      process.env.USEFUL_MAPS_PUBLIC_PAGE_SIZE_MAX,
      24,
      'USEFUL_MAPS_PUBLIC_PAGE_SIZE_MAX'
    ),
    blobPathPrefix: process.env.USEFUL_MAPS_BLOB_PATH_PREFIX?.trim() || 'useful-maps',
    allowedUploadMimeTypes: parseCsvList(process.env.USEFUL_MAPS_ALLOWED_MIME_TYPES, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
    ]),
    uploadTicketSecret: uploadTicketSecret || 'dev-useful-maps-upload-ticket-secret',
    uploadTicketIssuer: process.env.USEFUL_MAPS_UPLOAD_TICKET_ISSUER?.trim() || 'geoguessr-helper',
    uploadTicketAudience:
      process.env.USEFUL_MAPS_UPLOAD_TICKET_AUDIENCE?.trim() || 'useful-maps-upload',
    maxUploadBytes: parsePositiveInteger(
      process.env.USEFUL_MAPS_MAX_UPLOAD_BYTES,
      15 * 1024 * 1024,
      'USEFUL_MAPS_MAX_UPLOAD_BYTES'
    ),
    allowedBlobHosts: parseCsvList(process.env.USEFUL_MAPS_ALLOWED_BLOB_HOSTS, [
      // Vercel Blob public domains
      'pub-*.r2.dev',
      'pub-*.s3.amazonaws.com',
    ]),
  };
}
