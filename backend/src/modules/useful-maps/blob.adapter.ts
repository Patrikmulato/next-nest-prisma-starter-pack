export type PublicBlobHead = {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

export async function headPublicBlob(
  url: string,
  allowedBlobHosts: readonly string[]
): Promise<PublicBlobHead> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid blob URL');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Blob URL must use HTTPS');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('Blob URL must not contain credentials');
  }

  if (parsedUrl.port) {
    throw new Error('Blob URL must not specify a port');
  }

  const normalizedHostname = normalizeHostname(parsedUrl.hostname);

  // Inline allow-list match (not delegated to a helper) so the static analyzer can see,
  // in this same function, that only a hostname equal to or a subdomain of one of the
  // fixed, server-configured entries in allowedBlobHosts is ever used below.
  let matchedHost: string | undefined;
  for (const rawPattern of allowedBlobHosts) {
    const pattern = normalizeHostname(rawPattern);
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      if (normalizedHostname.length > suffix.length && normalizedHostname.endsWith(`.${suffix}`)) {
        matchedHost = normalizedHostname;
        break;
      }
    } else if (pattern === normalizedHostname) {
      matchedHost = pattern;
      break;
    }
  }

  if (!matchedHost) {
    throw new Error('Blob host is not allowed');
  }

  // Reconstruct the URL from validated parts only: HTTPS, no credentials, no explicit
  // port, the matched allow-listed hostname, and no query string. Redirects are rejected
  // so an allowed host can never bounce the request to an unintended address.
  const safeUrl = `https://${matchedHost}${parsedUrl.pathname}`;
  const response = await fetch(safeUrl, { method: 'HEAD', redirect: 'error' }); // codeql[js/request-forgery]
  if (!response.ok) {
    throw new Error(`Blob HEAD request failed with status ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const parsedLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;

  return {
    contentType: response.headers.get('content-type'),
    contentLength: Number.isFinite(parsedLength) ? parsedLength : null,
    etag: response.headers.get('etag'),
  };
}
