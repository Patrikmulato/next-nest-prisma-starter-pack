import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { verifyUsefulMapUploadTicket } from '@/lib/useful-maps/upload-ticket';

type ClientUploadPayload = {
  uploadTicket: string;
  mimeType: string;
  sizeBytes: number;
};

function parseClientPayload(clientPayload: string | null): ClientUploadPayload {
  if (!clientPayload) {
    throw new Error('Missing upload payload');
  }

  const parsed = JSON.parse(clientPayload) as Partial<ClientUploadPayload>;
  if (
    typeof parsed.uploadTicket !== 'string' ||
    typeof parsed.mimeType !== 'string' ||
    typeof parsed.sizeBytes !== 'number'
  ) {
    throw new Error('Invalid upload payload');
  }

  return parsed as ClientUploadPayload;
}

function getUploadTicketSecret(): string {
  const secret = process.env.USEFUL_MAPS_UPLOAD_TICKET_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('USEFUL_MAPS_UPLOAD_TICKET_SECRET is required in production');
  }

  return secret || 'dev-useful-maps-upload-ticket-secret';
}

function getUploadTicketIssuer(): string {
  return process.env.USEFUL_MAPS_UPLOAD_TICKET_ISSUER?.trim() || 'geoguessr-helper';
}

function getUploadTicketAudience(): string {
  return process.env.USEFUL_MAPS_UPLOAD_TICKET_AUDIENCE?.trim() || 'useful-maps-upload';
}

function normalizePathPrefix(prefix: string): string {
  return prefix.replace(/\/+$/, '');
}

function matchesPathnamePrefix(pathname: string, prefix: string): boolean {
  const normalizedPrefix = normalizePathPrefix(prefix);
  if (pathname === normalizedPrefix) {
    return true;
  }

  if (!pathname.startsWith(normalizedPrefix)) {
    return false;
  }

  const separator = pathname.charAt(normalizedPrefix.length);
  return separator === '/' || separator === '.' || separator === '-' || separator === '_';
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        const payload = parseClientPayload(clientPayload);
        const claims = verifyUsefulMapUploadTicket(payload.uploadTicket, {
          secret: getUploadTicketSecret(),
          expectedIssuer: getUploadTicketIssuer(),
          expectedAudience: getUploadTicketAudience(),
        });

        const normalizedPathnamePrefix = normalizePathPrefix(claims.pathnamePrefix);
        if (!matchesPathnamePrefix(pathname, normalizedPathnamePrefix)) {
          throw new Error('Upload pathname does not match the ticket prefix');
        }

        if (!claims.allowedContentTypes.includes(payload.mimeType)) {
          throw new Error('Upload MIME type is not permitted');
        }

        if (payload.sizeBytes > claims.maximumSizeInBytes) {
          throw new Error('Upload exceeds the allowed size');
        }

        return {
          allowedContentTypes: [...claims.allowedContentTypes],
          maximumSizeInBytes: claims.maximumSizeInBytes,
          addRandomSuffix: true,
          validUntil: claims.exp * 1000,
          tokenPayload: JSON.stringify({
            uploadTicket: payload.uploadTicket,
            pathnamePrefix: normalizedPathnamePrefix,
            multipart,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Blob upload authorization failed' },
      { status: 400 }
    );
  }
}
