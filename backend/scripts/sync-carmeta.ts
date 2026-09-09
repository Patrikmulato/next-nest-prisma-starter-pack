// Auto-generates backend/src/data/car-meta-coords.ts from the carmeta GitHub repo.
// Run: pnpm --filter geoguessr-helper-backend sync:carmeta
//
// Fetches per-country JSON files from https://github.com/iggedi-ig-ig/carmeta,
// samples up to MAX_SAMPLES_PER_COUNTRY coordinates per country, extracts car
// color from free-text tags, and writes a compact TypeScript data file.

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_OWNER = 'iggedi-ig-ig';
const REPO_NAME = 'carmeta';
const BRANCH = 'main';
const MAX_SAMPLES_PER_COUNTRY = 400;

// Known region folder names at the repo root
const REGION_FOLDERS = new Set([
  'Africa',
  'Asia',
  'CentralAmerica',
  'Europe',
  'NorthAmerica',
  'Oceania',
  'SouthAmerica',
]);

// Map folder names (URL-encoded country sub-directory) to canonical country names.
// Keys are the raw folder names as they appear in the repo path.
const FOLDER_TO_COUNTRY: Record<string, string | null> = {
  SouthAfrica: 'South Africa',
  Bangladesh: 'Bangladesh',
  Thailand: null, // zip file only — skipped
  CostaRica: 'Costa Rica',
  Austria: 'Austria',
  Baltics: null, // multi-country region — skipped
  Bosnia: 'Bosnia and Herzegovina',
  Bulgaria: 'Bulgaria',
  Croatia: 'Croatia',
  CzechRepublic: 'Czech Republic',
  Denmark: 'Denmark',
  Finland: 'Finland',
  France: 'France',
  Germany: 'Germany',
  Greece: 'Greece',
  Hungary: 'Hungary',
  Ireland: 'Ireland',
  Italy: 'Italy',
  Luxembourg: 'Luxembourg',
  Netherlands: 'Netherlands',
  Norway: 'Norway',
  Poland: 'Poland',
  Romania: 'Romania',
  Slovakia: 'Slovakia',
  Slovenia: 'Slovenia',
  Spain: 'Spain',
  Sweden: 'Sweden',
  Türkiye: 'Turkey',
  UnitedKingdom: 'United Kingdom',
  Canada: 'Canada',
  Mexico: 'Mexico',
  Australia: 'Australia',
  NewZealand: 'New Zealand',
  Brazil: 'Brazil',
  Chile: 'Chile',
  Peru: 'Peru',
};

// colorIdx encoding used in the output tuple [lat, lng, colorIdx]
const COLOR_PREFIXES: Array<[string, number]> = [
  ['white-blue', 8],
  ['striped', 7],
  ['gray', 6],
  ['grey', 6],
  ['navy', 5],
  ['red', 4],
  ['white', 3],
  ['blue', 2],
  ['black', 1],
];

function extractColorIdx(tags: string[]): number {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [prefix, idx] of COLOR_PREFIXES) {
      if (lower.startsWith(prefix)) return idx;
    }
  }
  return 0;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'geoguessr-helper-sync' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) return reject(new Error(`Redirect with no location from ${url}`));
        resolve(httpsGet(location));
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode ?? 'unknown'} from ${url}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

type GitTreeItem = { path: string; type: string };

async function fetchRepoTree(): Promise<GitTreeItem[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`;
  console.log('Fetching repo tree...');
  const raw = await httpsGet(url);
  const json = JSON.parse(raw) as { tree: GitTreeItem[]; truncated?: boolean };
  if (json.truncated) {
    console.warn('Warning: GitHub tree response was truncated — some files may be missing.');
  }
  return json.tree;
}

type CarmetaCoordinate = {
  lat: number;
  lng: number;
  extra?: { tags?: string[] };
};

type CarmetaFile = {
  customCoordinates?: CarmetaCoordinate[];
};

async function fetchAndParseCountryFile(filePath: string): Promise<CarmetaCoordinate[]> {
  const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;
  console.log(`  Fetching ${filePath}...`);
  const raw = await httpsGet(rawUrl);
  const parsed = JSON.parse(raw) as CarmetaFile;
  return parsed.customCoordinates ?? [];
}

function sampleCoords(coords: CarmetaCoordinate[], max: number): Array<[number, number, number]> {
  if (coords.length === 0) return [];
  const step = coords.length <= max ? 1 : Math.floor(coords.length / max);
  const result: Array<[number, number, number]> = [];
  for (let i = 0; i < coords.length && result.length < max; i += step) {
    const c = coords[i];
    const colorIdx = extractColorIdx(c.extra?.tags ?? []);
    if (colorIdx === 0) continue; // skip unknown-color points
    result.push([Math.round(c.lat * 1000) / 1000, Math.round(c.lng * 1000) / 1000, colorIdx]);
  }
  return result;
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(scriptDir, '..');
  const outputPath = path.join(backendDir, 'src', 'data', 'car-meta-coords.ts');

  const tree = await fetchRepoTree();

  // Group JSON files by country folder
  const filesByCountryFolder = new Map<string, string[]>();

  for (const item of tree) {
    if (item.type !== 'blob') continue;
    if (!item.path.endsWith('.json')) continue; // skip .json.zip and non-json
    if (item.path.endsWith('.json.zip')) continue;

    const parts = item.path.split('/');
    if (parts.length < 3) continue;
    const region = parts[0];
    const folder = parts[1];

    if (!REGION_FOLDERS.has(region)) continue;

    const folderKey = folder;
    if (!filesByCountryFolder.has(folderKey)) {
      filesByCountryFolder.set(folderKey, []);
    }
    filesByCountryFolder.get(folderKey)!.push(item.path);
  }

  const result: Record<string, Array<[number, number, number]>> = {};
  let totalDots = 0;

  for (const [folder, files] of filesByCountryFolder) {
    const country = FOLDER_TO_COUNTRY[folder];
    if (country === null) {
      console.log(`Skipping ${folder} (multi-country region or zip-only)`);
      continue;
    }
    if (country === undefined) {
      console.log(`Skipping ${folder} (unknown folder — add to FOLDER_TO_COUNTRY if needed)`);
      continue;
    }

    console.log(`Processing ${country} (${files.length} file(s))...`);

    // Collect all coordinates from all files for this country
    const allCoords: CarmetaCoordinate[] = [];
    for (const filePath of files) {
      try {
        const coords = await fetchAndParseCountryFile(filePath);
        for (const c of coords) allCoords.push(c);
      } catch (err) {
        console.warn(`  Warning: failed to fetch ${filePath}: ${(err as Error).message}`);
      }
    }

    const sampled = sampleCoords(allCoords, MAX_SAMPLES_PER_COUNTRY);
    if (sampled.length > 0) {
      result[country] = sampled;
      totalDots += sampled.length;
      console.log(`  → ${sampled.length} sample points`);
    } else {
      console.log(`  → no usable points (all unknown color)`);
    }
  }

  // Build output TypeScript
  const countryEntries = Object.entries(result)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, coords]) => {
      const coordStr = coords.map(([lat, lng, c]) => `[${lat},${lng},${c}]`).join(',');
      return `  ${JSON.stringify(country)}: [${coordStr}]`;
    })
    .join(',\n');

  const output = [
    `// Auto-generated from https://github.com/${REPO_OWNER}/${REPO_NAME}`,
    `// Do not edit by hand. Run: pnpm --filter geoguessr-helper-backend sync:carmeta`,
    `//`,
    `// colorIdx encoding: 1=black 2=blue 3=white 4=red 5=navy 6=grey 7=striped 8=white-blue`,
    ``,
    `export type ColorIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;`,
    ``,
    `export const carMetaCoordsData: Record<string, Array<[number, number, ColorIdx]>> = {`,
    countryEntries,
    `};`,
    ``,
  ].join('\n');

  fs.writeFileSync(outputPath, output, 'utf8');

  const countryCount = Object.keys(result).length;
  console.log(`\nDone. Wrote ${countryCount} countries, ${totalDots} total sample points to:`);
  console.log(`  ${outputPath}`);
}

main().catch((err) => {
  console.error('sync-carmeta failed:', err);
  process.exit(1);
});
