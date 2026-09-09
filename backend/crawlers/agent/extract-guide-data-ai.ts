/**
 * AI-powered guide data extractor (Stage 4b)
 *
 * Reads countries_master.json, calls Claude per country to extract structured
 * GeoGuessr metadata, and writes crawler-extracted-ai.json.
 *
 * Uses the `claude` CLI (Claude Code) — no separate API key required.
 * Authentication reuses your existing Claude Code session.
 *
 * Run: pnpm --filter geoguessr-helper-backend extract:guides:ai
 * Env: CLAUDE_BIN          (optional) path to claude binary; defaults to ~/.local/bin/claude
 *      AI_MODEL            (optional, default: haiku) model alias or full ID
 *      AI_CONFIDENCE_THRESHOLD (optional, default: 0.7)
 *      AI_CRAWL_DELAY_MS   (optional, default: 1000)
 *      AI_CRAWL_LIMIT      (optional, for testing with N countries)
 *      AI_COUNTRY          (optional, test a single country slug e.g. "namibia")
 * Output: backend/crawlers/data/crawler-extracted-ai.json
 *         backend/crawlers/data/crawler-extraction-ai-review.json
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROAD_LINE_ALLOWED,
  CAR_COLOR_ALLOWED,
  titleCaseCountry,
  normalizeCountry,
} from '../lib/ts-file-patcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'extraction-data');
const AGENT_DATA_DIR = path.join(__dirname, '..', 'data');
const MASTER_PATH = path.join(AGENT_DATA_DIR, 'countries_master.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'crawler-extracted-ai.json');
const REVIEW_PATH = path.join(DATA_DIR, 'crawler-extraction-ai-review.json');

const MAX_TEXT_CHARS = 12_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type FieldExtraction = {
  values: (string | number)[];
  confidence: number;
  reasoning: string;
};

type VehicleTypeExtraction = FieldExtraction & { comment?: string };
type CarColorExtraction = FieldExtraction & { explanation?: string };

type CountryAIExtraction = {
  slug: string;
  roadLines: FieldExtraction;
  carColor: CarColorExtraction;
  cameraGen: FieldExtraction;
  coverageYears: FieldExtraction;
  vehicleType: VehicleTypeExtraction;
  extractionError: string | null;
};

type AIExtractionOutput = {
  metadata: {
    generated_at: string;
    model: string;
    confidence_threshold: number;
    countries_total: number;
    countries_processed: number;
    countries_failed: number;
  };
  countries: Record<string, CountryAIExtraction>;
};

type ExtractionToolInput = {
  roadLines: { values: string[]; confidence: number; reasoning: string };
  carColor: { values: string[]; confidence: number; reasoning: string; explanation?: string };
  cameraGen: { values: number[]; confidence: number; reasoning: string };
  coverageYears: { values: number[]; confidence: number; reasoning: string };
  vehicleType: { values: string[]; confidence: number; reasoning: string; comment?: string };
};

type CountryMaster = {
  metadata: {
    source: string;
    extraction_date: string;
    total_countries: number;
    scraper_version: string;
  };
  countries: Record<
    string,
    {
      url: string;
      content_sections: Array<{
        section_id: number;
        image: { url: string; alt?: string; position?: string } | null;
        text: { content: string; headings?: string[]; paragraphs?: string[] };
      }>;
    }
  >;
};

// ─── Env loading ─────────────────────────────────────────────────────────────

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf-8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]?.trim()) continue;
    process.env[key] = rawValue.replace(/^['\"]|['\"]$/g, '').trim();
  }
}

function loadLocalEnv(): void {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const backendRoot = path.resolve(__dirname, '..', '..');
  for (const p of [
    path.join(repoRoot, '.env.local'),
    path.join(repoRoot, '.env'),
    path.join(backendRoot, '.env.local'),
    path.join(backendRoot, '.env'),
  ]) {
    loadEnvFile(p);
  }
}

// ─── Prompt / tool definition ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a precise data extractor for GeoGuessr country guides from plonkit.net. Extract specific Google Street View metadata clues from guide text.

## Fields to Extract

### roadLines
The pattern of painted road marking colors as "outside-inside":
- "outside" = color of the line at the road edge (closest to shoulder/verge)
- "inside" = color of the center line(s) dividing opposing traffic
Valid values: yellow-white, white-white, white-yellow, yellow-yellow, white-whiteyellow, yellow-whiteyellow, white-whitegreen, red-white, red-yellow, blue-orange, blue-white, blue-blue
A country may have multiple patterns (different road types).
Look for: "outside X inside Y", "X center line", "Y outer lines", "X middle line and Y outer line", "white/yellow lane markings"

### carColor
The color of the Google Street View capture vehicle.
Valid values: black, blue, gray, red, striped, white, white-blue, white-blue-white, other
- "striped" = car with colored stripes or decals
- "white-blue" = car with both white and blue coloring
- "white-blue-white" = car with white-blue-white pattern
- "other" = any unusual color not covered above; you MUST also populate the explanation field describing it
Multiple colors valid if different generations use different cars.
Look for: "X car", "Google car is X", "blue Street View car", "striped car", explicit color descriptions of the vehicle.

### cameraGen
Camera generation numbers documented in this country.
Valid values: integers 1, 2, 3, 4
Look for: "Generation N", "Gen N", "Gen. N coverage", "camera generation N"
Multiple generations are valid.

### coverageYears
Years when coverage was captured or published (integers, 2007–2035).
Look for: copyright year labels ("© 2022 Google"), "coverage from YYYY", "updated YYYY", "YYYY coverage", years near "Street View" or "Google".
Be conservative — only years explicitly linked to Street View coverage.

### vehicleType
The Google Street View capture vehicle type. Valid: "car", "truck", "roofrack", "other".
- "car" = standard car (set only when the guide explicitly confirms it)
- "truck" = truck, pickup truck, commercial vehicle, trekker
- "roofrack" = car with a visible roof rack mounted on top (e.g. "grey car with visible roof rack")
- "other" = any unusual vehicle not covered above; you MUST also populate the comment field describing it
Leave empty if the vehicle type is not mentioned at all.

## Confidence Scoring
- 0.9–1.0: Multiple explicit, consistent mentions
- 0.7–0.89: One clear explicit mention
- 0.5–0.69: Inferred from context or indirect reference
- 0.3–0.49: Possible but ambiguous
- 0.0: No evidence found (return empty values array)

## Examples

### Example 1: United States
<guide_text>
The United States uses yellow center lines to divide traffic going in opposite directions. White outer lines mark the edge of the road. Double yellow center lines are the most common pattern on two-lane roads. Highway dividing lines are yellow dashed. Generation 1 coverage can be found in major cities from the earliest Street View era. Generation 2 coverage adds suburban areas. Generations 3 and 4 are the most common today throughout the country.
</guide_text>
Expected extraction:
- roadLines: values=["yellow-white"], confidence=0.92 (yellow center/inside + white outer/outside — explicitly stated)
- cameraGen: values=[1,2,3,4], confidence=0.95 (all four generations explicitly named)
- carColor: values=[], confidence=0.0 (no car color mentioned)
- coverageYears: values=[], confidence=0.0 (no specific years cited)
- vehicleType: values=["car"], confidence=0.88 ("cars" mentioned many times explicitly — "Generation 3 car", "the car isn’t blurred ")

### Example 2: Bangladesh
<guide_text>
In Generation 3 coverage, three Street View cars are seen in Bangladesh: the classic striped car with colored decals, a regular white car, and a car with distinctive red mirrors. In Generation 4 coverage, two cars are documented: a black car and a white car. Copyright labels show 2022 and 2023 as the most recent coverage years for Generation 4.
</guide_text>
Expected extraction:
- carColor: values=["black","striped","white"], confidence=0.93 (all three explicitly named)
- cameraGen: values=[3,4], confidence=0.95 (both explicitly named)
- coverageYears: values=[2022,2023], confidence=0.90 (explicitly from copyright labels)
- roadLines: values=[], confidence=0.0 (not mentioned)
- vehicleType: values=["car"], confidence=0.88 ("cars" mentioned many times explicitly — "three Street View cars", "two cars are documented", etc.)

### Example 3: New Zealand
<guide_text>
New Zealand normally uses white outer road lines. Yellow dashed center lines are common on two-lane rural roads (white inside + yellow outside on some sections). On urban divided roads, yellow outer lines can be seen. Some highways have both white outer and white center lines with no yellow markings at all.
</guide_text>
Expected extraction:
- roadLines: values=["white-white","white-yellow","yellow-white"], confidence=0.85 (multiple explicit patterns: white outer + white center, white outer + yellow center, yellow outer + white/no center)
- carColor: values=["white-blue", "white-blue-white"], confidence=0.85 ("car with a white and blue", "car features a white-blue-white")
- cameraGen: values=[2,3,4], confidence=0.95 ("Generation 2", "Generation 3", "Generation 4")
- coverageYears: values=[2012], confidence=0.80 ("roads on coverage from 2012, no other years mentioned")
- vehicleType: values=["car"], confidence=0.95 ("white Street View car", "Car metas")

### Example 4: Australia
<guide_text>
Google Street View in Australia primarily uses a large truck rather than a standard car. In some regions, a distinctive blue Generation 4 car is used instead. The Stuart Highway in the Northern Territory is captured with a blue car. Standard white cars are used in most metropolitan coverage areas. Generation 3 coverage uses the older antenna-equipped car.
</guide_text>
Expected extraction:
- vehicleType: values=["truck","car"], confidence=0.90 (both explicitly named — truck as primary, car in specific regions)
- carColor: values=["blue","white"], confidence=0.88 (blue car and white car both explicitly mentioned)
- cameraGen: values=[3,4], confidence=0.88 (generations 3 and 4 both named)
- roadLines: values=[""], confidence=0.0 (not mentioned)
- coverageYears: values=[], confidence=0.0 (no specific years)

Always call the extract_country_data tool with your findings. Return empty arrays with confidence 0.0 for fields with no evidence.`;

// JSON schema passed to `claude --json-schema` for structured output enforcement
const EXTRACTION_SCHEMA = {
  type: 'object',
  required: ['roadLines', 'carColor', 'cameraGen', 'coverageYears', 'vehicleType'],
  properties: {
    roadLines: {
      type: 'object',
      description: 'Road line marking patterns (outside-inside color format)',
      required: ['values', 'confidence', 'reasoning'],
      properties: {
        values: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
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
            ],
          },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
    },
    carColor: {
      type: 'object',
      description: 'Color(s) of the Google Street View vehicle',
      required: ['values', 'confidence', 'reasoning'],
      properties: {
        values: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'black',
              'blue',
              'gray',
              'red',
              'striped',
              'white',
              'white-blue',
              'white-blue-white',
              'other',
            ],
          },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        explanation: {
          type: 'string',
          description: 'Required when values contains "other" — describe the unusual color',
        },
      },
    },
    cameraGen: {
      type: 'object',
      description: 'Camera generations present in this country',
      required: ['values', 'confidence', 'reasoning'],
      properties: {
        values: {
          type: 'array',
          items: { type: 'integer', enum: [1, 2, 3, 4] },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
    },
    coverageYears: {
      type: 'object',
      description: 'Years when Street View coverage was captured (2007–2035)',
      required: ['values', 'confidence', 'reasoning'],
      properties: {
        values: {
          type: 'array',
          items: { type: 'integer', minimum: 2007, maximum: 2035 },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
      },
    },
    vehicleType: {
      type: 'object',
      description: 'Capture vehicle type ("car", "truck", "roofrack", or "other")',
      required: ['values', 'confidence', 'reasoning'],
      properties: {
        values: {
          type: 'array',
          items: { type: 'string', enum: ['car', 'truck', 'roofrack', 'other'] },
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' },
        comment: {
          type: 'string',
          description: 'Required when values contains "other" — describe the unusual vehicle',
        },
      },
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gatherCountryText(
  sections: CountryMaster['countries'][string]['content_sections']
): string {
  const parts: string[] = [];
  for (const s of sections) {
    if (s.text.content) parts.push(s.text.content);
    if (s.text.headings?.length) parts.push(s.text.headings.join(' '));
    if (s.text.paragraphs?.length) parts.push(s.text.paragraphs.join(' '));
  }
  const full = parts.join('\n');
  return full.length > MAX_TEXT_CHARS ? full.slice(0, MAX_TEXT_CHARS) : full;
}

function emptyField(reasoning = 'No data found'): FieldExtraction {
  return { values: [], confidence: 0.0, reasoning };
}

function validateAndCleanField(
  field:
    | ExtractionToolInput['roadLines']
    | ExtractionToolInput['carColor']
    | ExtractionToolInput['cameraGen']
    | ExtractionToolInput['coverageYears']
    | ExtractionToolInput['vehicleType'],
  allowed: Set<string | number>,
  type: 'string' | 'number'
): FieldExtraction {
  const cleaned = (field.values as (string | number)[]).filter((v) => {
    if (type === 'number') return typeof v === 'number' && allowed.has(v);
    return typeof v === 'string' && allowed.has(v);
  });
  const confidence = Math.min(1, Math.max(0, field.confidence));
  return { values: Array.from(new Set(cleaned)), confidence, reasoning: field.reasoning ?? '' };
}

const VALID_GENS = new Set([1, 2, 3, 4]);
const VALID_VEHICLE_TYPES = new Set(['car', 'truck', 'roofrack', 'other']);

type ValidatedFields = {
  roadLines: FieldExtraction;
  carColor: CarColorExtraction;
  cameraGen: FieldExtraction;
  coverageYears: FieldExtraction;
  vehicleType: VehicleTypeExtraction;
};

function validateExtraction(raw: ExtractionToolInput): ValidatedFields {
  const coverageYearAllowed = new Set(Array.from({ length: 2035 - 2007 + 1 }, (_, i) => 2007 + i));

  const carColorBase = validateAndCleanField(raw.carColor, CAR_COLOR_ALLOWED, 'string');
  const carColor: CarColorExtraction =
    carColorBase.values.includes('other') && raw.carColor.explanation
      ? { ...carColorBase, explanation: raw.carColor.explanation }
      : carColorBase;

  const vehicleBase = validateAndCleanField(raw.vehicleType, VALID_VEHICLE_TYPES, 'string');
  const vehicleType: VehicleTypeExtraction =
    vehicleBase.values.includes('other') && raw.vehicleType.comment
      ? { ...vehicleBase, comment: raw.vehicleType.comment }
      : vehicleBase;

  return {
    roadLines: validateAndCleanField(raw.roadLines, ROAD_LINE_ALLOWED, 'string'),
    carColor,
    cameraGen: validateAndCleanField(
      raw.cameraGen as Parameters<typeof validateAndCleanField>[0],
      VALID_GENS,
      'number'
    ),
    coverageYears: validateAndCleanField(
      raw.coverageYears as Parameters<typeof validateAndCleanField>[0],
      coverageYearAllowed,
      'number'
    ),
    vehicleType,
  };
}

// ─── Claude CLI call ──────────────────────────────────────────────────────────

function resolveClaude(): string {
  const fromEnv = process.env.CLAUDE_BIN?.trim();
  if (fromEnv) return fromEnv;
  const localBin = path.join(process.env.HOME ?? '~', '.local', 'bin', 'claude');
  if (fs.existsSync(localBin)) return localBin;
  return 'claude';
}

function callClaude(model: string, userMessage: string): Promise<string> {
  const claudeBin = resolveClaude();
  return new Promise((resolve, reject) => {
    const proc = spawn(
      claudeBin,
      [
        '-p',
        '--output-format',
        'json',
        '--model',
        model,
        '--system-prompt',
        SYSTEM_PROMPT,
        '--json-schema',
        JSON.stringify(EXTRACTION_SCHEMA),
        '--no-session-persistence',
      ],
      { env: process.env }
    );

    proc.stdin.write(userMessage);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as {
          result?: string;
          is_error?: boolean;
          structured_output?: unknown;
        };
        if (parsed.is_error) {
          reject(new Error(`claude error: ${parsed.result ?? 'unknown'}`));
          return;
        }
        if (parsed.structured_output !== undefined) {
          resolve(JSON.stringify(parsed.structured_output));
          return;
        }
        // Fallback: strip markdown fences from result text
        const raw = parsed.result ?? '';
        resolve(
          raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/, '')
            .trim()
        );
      } catch {
        reject(new Error(`Failed to parse claude output: ${stdout.slice(0, 300)}`));
      }
    });

    proc.on('error', (err) => reject(new Error(`Failed to spawn claude: ${err.message}`)));
  });
}

// ─── Main extraction ──────────────────────────────────────────────────────────

async function extractCountry(
  model: string,
  slug: string,
  displayName: string,
  text: string,
  maxRetries = 3
): Promise<CountryAIExtraction> {
  const userPrompt = `Extract GeoGuessr metadata for country: ${displayName}\n\n<guide_text>\n${text}\n</guide_text>`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const responseText = await callClaude(model, userPrompt);
      const raw = JSON.parse(responseText) as ExtractionToolInput;
      const validated = validateExtraction(raw);
      return { slug, ...validated, extractionError: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        const wait = Math.min(60_000, 2 ** attempt * 2_000);
        console.warn(
          `  Attempt ${attempt} failed for ${displayName}, retrying in ${wait}ms: ${message}`
        );
        await sleep(wait);
        continue;
      }
      return {
        slug,
        roadLines: emptyField(),
        carColor: emptyField(),
        cameraGen: emptyField(),
        coverageYears: emptyField(),
        vehicleType: emptyField(),
        extractionError: message,
      };
    }
  }

  return {
    slug,
    roadLines: emptyField(),
    carColor: emptyField(),
    cameraGen: emptyField(),
    coverageYears: emptyField(),
    vehicleType: emptyField(),
    extractionError: 'Exhausted retries',
  };
}

// ─── Review report ────────────────────────────────────────────────────────────

function buildReview(countries: Record<string, CountryAIExtraction>, threshold: number): unknown {
  type FieldStats = {
    extracted: number;
    above_threshold: number;
    total_confidence: number;
    avg_confidence: number;
  };
  const fields = ['roadLines', 'carColor', 'cameraGen', 'coverageYears', 'vehicleType'] as const;
  const stats: Record<string, FieldStats> = {};
  for (const f of fields)
    stats[f] = { extracted: 0, above_threshold: 0, total_confidence: 0, avg_confidence: 0 };

  const entries: unknown[] = [];

  for (const [name, data] of Object.entries(countries)) {
    const below: string[] = [];
    for (const f of fields) {
      const field = data[f];
      if (field.values.length > 0) {
        stats[f].extracted++;
        stats[f].total_confidence += field.confidence;
        if (field.confidence >= threshold) stats[f].above_threshold++;
        else below.push(f);
      }
    }
    entries.push({
      country: name,
      slug: data.slug,
      extractionError: data.extractionError,
      confidences: Object.fromEntries(fields.map((f) => [f, data[f].confidence])),
      below_threshold: below,
    });
  }

  for (const f of fields) {
    const s = stats[f];
    s.avg_confidence =
      s.extracted > 0 ? Math.round((s.total_confidence / s.extracted) * 100) / 100 : 0;
  }

  return {
    generated_at: new Date().toISOString(),
    confidence_threshold: threshold,
    summary_by_field: stats,
    countries: entries,
  };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadLocalEnv();

  const model = process.env.AI_MODEL ?? 'haiku';
  const threshold = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? '0.7');
  const delayMs = Number(process.env.AI_CRAWL_DELAY_MS ?? '1000');
  const limit = process.env.AI_CRAWL_LIMIT ? Number(process.env.AI_CRAWL_LIMIT) : undefined;
  const countryFilter = process.env.AI_COUNTRY?.toLowerCase().trim();

  if (!fs.existsSync(MASTER_PATH)) {
    console.error(`Missing: ${MASTER_PATH}. Run consolidate:guides first.`);
    process.exit(1);
  }

  const master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf-8')) as CountryMaster;

  let slugs = Object.keys(master.countries);
  if (countryFilter) {
    slugs = slugs.filter(
      (s) => s === countryFilter || titleCaseCountry(s).toLowerCase() === countryFilter
    );
    if (slugs.length === 0) {
      console.error(
        `No country found matching "${countryFilter}". Available slugs include: ${Object.keys(master.countries).slice(0, 5).join(', ')}...`
      );
      process.exit(1);
    }
  }
  if (limit) slugs = slugs.slice(0, limit);

  const total = slugs.length;
  console.log(`Extracting ${total} countries with model=${model}, threshold=${threshold}`);

  const result: AIExtractionOutput = {
    metadata: {
      generated_at: new Date().toISOString(),
      model,
      confidence_threshold: threshold,
      countries_total: total,
      countries_processed: 0,
      countries_failed: 0,
    },
    countries: {},
  };

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const displayName = normalizeCountry(titleCaseCountry(slug));
    const text = gatherCountryText(master.countries[slug].content_sections);

    const extraction = await extractCountry(model, slug, displayName, text);

    if (extraction.extractionError) {
      result.metadata.countries_failed++;
      console.log(`[${i + 1}/${total}] ${displayName} → ERROR: ${extraction.extractionError}`);
    } else {
      result.metadata.countries_processed++;
      const fieldSummary =
        (['roadLines', 'carColor', 'cameraGen', 'coverageYears', 'vehicleType'] as const)
          .filter((f) => extraction[f].values.length > 0)
          .map(
            (f) => `${f}: ${extraction[f].values.length} (${extraction[f].confidence.toFixed(2)})`
          )
          .join(', ') || 'no data';
      console.log(`[${i + 1}/${total}] ${displayName} → ${fieldSummary}`);
    }

    result.countries[displayName] = extraction;

    if (i < slugs.length - 1) await sleep(delayMs);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(
    `  Processed: ${result.metadata.countries_processed}, Failed: ${result.metadata.countries_failed}`
  );

  const review = buildReview(result.countries, threshold);
  fs.writeFileSync(REVIEW_PATH, JSON.stringify(review, null, 2), 'utf-8');
  console.log(`Wrote ${REVIEW_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
