import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { head, put } from '@vercel/blob';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../generated/prisma/index.js';

type LegacyUsefulMapManifestEntry = {
  title: string;
  categorySlug: string;
  blobPathname: string;
  imageUrl: string;
  sourceFilePath: string;
  mimeType: string;
  uploaderEmail?: string;
};

type MigrationSummary = {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
};

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  'license-plates': 'License Plates',
  'road-signs': 'Road Signs',
  'road-lines': 'Road Lines',
  bollards: 'Bollards',
  'meta-clues': 'Meta Clues',
  us: 'US',
  japan: 'Japan',
  australia: 'Australia',
  europe: 'Europe',
  brazil: 'Brazil',
  vietnam: 'Vietnam',
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseManifest(raw: string): LegacyUsefulMapManifestEntry[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Legacy useful maps manifest must be a JSON array');
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Manifest entry ${index} must be an object`);
    }

    const record = entry as Record<string, unknown>;
    const requiredFields: Array<keyof Omit<LegacyUsefulMapManifestEntry, 'uploaderEmail'>> = [
      'title',
      'categorySlug',
      'blobPathname',
      'imageUrl',
      'sourceFilePath',
      'mimeType',
    ];

    for (const field of requiredFields) {
      if (!isNonEmptyString(record[field])) {
        throw new Error(`Manifest entry ${index} is missing required field ${String(field)}`);
      }
    }

    return {
      title: record.title,
      categorySlug: record.categorySlug,
      blobPathname: record.blobPathname,
      imageUrl: record.imageUrl,
      sourceFilePath: record.sourceFilePath,
      mimeType: record.mimeType,
      uploaderEmail: isNonEmptyString(record.uploaderEmail) ? record.uploaderEmail : undefined,
    };
  });
}

function formatCategoryLabel(slug: string): string {
  const mapped = DEFAULT_CATEGORY_LABELS[slug];
  if (mapped) {
    return mapped;
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(scriptDir, '..');
  const workspaceRootDir = path.resolve(backendDir, '..');
  const manifestPath = path.join(scriptDir, 'useful-maps-legacy-manifest.json');
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.length === 0) {
    console.log(
      JSON.stringify(
        {
          processed: 0,
          created: 0,
          skipped: 0,
          failed: 0,
        },
        null,
        2
      )
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required when the legacy useful maps manifest is not empty');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const fallbackUploaderEmail = process.env.USEFUL_MAPS_LEGACY_UPLOADER_EMAIL?.trim();
  const summary: MigrationSummary = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    const uniqueCategorySlugs = Array.from(new Set(manifest.map((entry) => entry.categorySlug)));
    for (const categorySlug of uniqueCategorySlugs) {
      await prisma.usefulMapCategory.upsert({
        where: { slug: categorySlug },
        update: {},
        create: {
          slug: categorySlug,
          label: formatCategoryLabel(categorySlug),
        },
      });
    }

    for (const entry of manifest) {
      summary.processed += 1;

      try {
        const category = await prisma.usefulMapCategory.findUnique({
          where: { slug: entry.categorySlug },
        });
        if (!category) {
          throw new Error(`Category not found: ${entry.categorySlug}`);
        }

        const uploaderEmail = entry.uploaderEmail ?? fallbackUploaderEmail;
        const uploader = uploaderEmail
          ? await prisma.user.findFirst({
              where: {
                email: uploaderEmail,
                role: UserRole.ADMIN,
              },
              select: { id: true },
            })
          : await prisma.user.findFirst({
              where: { role: UserRole.ADMIN },
              orderBy: { createdAt: 'asc' },
              select: { id: true, email: true },
            });

        if (!uploader) {
          throw new Error(
            uploaderEmail
              ? `ADMIN uploader not found: ${uploaderEmail}`
              : 'No ADMIN user found. Set USEFUL_MAPS_LEGACY_UPLOADER_EMAIL or add an ADMIN user.'
          );
        }

        const existing = await prisma.usefulMap.findFirst({
          where: {
            OR: [{ blobPathname: entry.blobPathname }, { imageUrl: entry.imageUrl }],
          },
        });
        if (existing) {
          summary.skipped += 1;
          continue;
        }

        const sourcePath = path.isAbsolute(entry.sourceFilePath)
          ? entry.sourceFilePath
          : (() => {
              const cwdCandidate = path.resolve(process.cwd(), entry.sourceFilePath);
              if (fs.existsSync(cwdCandidate)) {
                return cwdCandidate;
              }

              const rootCandidate = path.resolve(workspaceRootDir, entry.sourceFilePath);
              if (fs.existsSync(rootCandidate)) {
                return rootCandidate;
              }

              return cwdCandidate;
            })();

        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Source file not found: ${sourcePath}`);
        }

        const fileBuffer = fs.readFileSync(sourcePath);
        const uploaded = await put(entry.blobPathname, fileBuffer, {
          access: 'public',
          contentType: entry.mimeType,
        });

        await head(uploaded.url);

        await prisma.usefulMap.create({
          data: {
            title: entry.title,
            categoryId: category.id,
            imageUrl: uploaded.url,
            blobPathname: entry.blobPathname,
            mimeType: entry.mimeType,
            sizeBytes: fileBuffer.byteLength,
            uploadedById: uploader.id,
          },
        });

        summary.created += 1;
      } catch (error: unknown) {
        summary.failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown migration failure';
        console.error(`Failed to migrate useful map ${entry.title}: ${message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify(
      {
        processed: summary.processed,
        created: summary.created,
        skipped: summary.skipped,
        failed: summary.failed,
      },
      null,
      2
    )
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
