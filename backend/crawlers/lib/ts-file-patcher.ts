import fs from 'fs';

export const ROAD_LINE_ALLOWED = new Set([
  'yellow-white',
  'white-white',
  'white-yellow',
  'yellow-yellow',
  'white-whiteyellow',
  'yellow-whiteyellow',
  'white-whitegreen',
  'red-white',
  'red-yellow',
  'blue-orange',
  'blue-white',
  'blue-blue',
]);

export const CAR_COLOR_ALLOWED = new Set([
  'black',
  'blue',
  'gray',
  'red',
  'striped',
  'white',
  'white-blue',
  'white-blue-white',
  'other',
]);

export const COUNTRY_MAP: Record<string, string> = {
  Curacao: 'Curaçao',
  Cocos: 'Cocos (Keeling) Islands',
  'Cocos Islands': 'Cocos (Keeling) Islands',
  Czechia: 'Czech Republic',
  Macau: 'Macao',
  'Isle Of Man': 'Isle of Man',
  'US Virgin Islands': 'United States Virgin Islands',
  'US Minor Outlying Islands': 'United States Minor Outlying Islands',
  'Israel West Bank': 'Palestine',
};

export function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeText(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function titleCaseCountry(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bUs\b/g, 'US')
    .replace(/\bUae\b/g, 'UAE');
}

export function normalizeCountry(name: string): string {
  return COUNTRY_MAP[name] ?? name;
}

export function findObjectBlock(
  content: string,
  exportName: string
): { start: number; end: number; body: string } {
  const startMarker = `export const ${exportName}`;
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Missing block for ${exportName}`);

  const openBrace = content.indexOf('{', start);
  if (openBrace === -1) throw new Error(`Missing opening brace for ${exportName}`);

  let depth = 0;
  let end = -1;
  for (let i = openBrace; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) throw new Error(`Missing closing brace for ${exportName}`);
  return {
    start: openBrace,
    end,
    body: content.slice(openBrace + 1, end),
  };
}

export function extractExistingKeys(blockBody: string): Set<string> {
  const keys = new Set<string>();
  const keyRe = /^\s*"([^"]+)"\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(blockBody))) {
    keys.add(m[1]);
  }
  return keys;
}

export function appendEntriesToExportObject(
  fileContent: string,
  exportName: string,
  entries: Array<{ key: string; valueLiteral: string }>
): string {
  if (entries.length === 0) return fileContent;

  const block = findObjectBlock(fileContent, exportName);
  const insertAt = block.end;

  const indentation = /\n(\s+)"[^"]+"\s*:/.exec(block.body)?.[1] ?? '  ';
  const toInsert =
    '\n' + entries.map((e) => `${indentation}"${e.key}": ${e.valueLiteral},`).join('\n');

  return fileContent.slice(0, insertAt) + toInsert + fileContent.slice(insertAt);
}

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .filter((n) => Number.isInteger(n));
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function pickVehicleType(
  values: string[]
): 'truck' | 'roofrack' | 'suv' | 'car' | 'other' | null {
  const normalized = new Set(values.map((v) => v.toLowerCase()));
  if (normalized.has('truck') || normalized.has('pickup') || normalized.has('commercial-vehicle'))
    return 'truck';
  if (normalized.has('roofrack')) return 'roofrack';
  if (normalized.has('suv')) return 'suv';
  if (normalized.has('car')) return 'car';
  if (normalized.has('other')) return 'other';
  return null;
}
