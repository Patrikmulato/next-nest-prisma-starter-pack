/**
 * Confidence-gated merge of AI extraction results (Stage 5)
 *
 * Reads crawler-extracted-ai.json and appends high-confidence values to
 * road-lines.ts and geo-car-helpdesk.ts. Strictly append-only — countries
 * already present in the target files are never modified.
 *
 * Run: pnpm --filter geoguessr-helper-backend merge:ai
 * Env: AI_CONFIDENCE_THRESHOLD (optional, default: 0.7)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ROAD_LINE_ALLOWED,
  CAR_COLOR_ALLOWED,
  readText,
  writeText,
  findObjectBlock,
  extractExistingKeys,
  appendEntriesToExportObject,
  unique,
  pickVehicleType,
} from '../lib/ts-file-patcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_JSON_PATH = path.join(__dirname, '..', 'data', 'crawler-extracted-ai.json');
const ROAD_LINES_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'road-lines.ts');
const GEO_HELPDESK_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'geo-car-helpdesk.ts');

type FieldExtraction = {
  values: (string | number)[];
  confidence: number;
  reasoning: string;
};

type CountryAIExtraction = {
  slug: string;
  roadLines: FieldExtraction;
  carColor: FieldExtraction & { explanation?: string };
  cameraGen: FieldExtraction;
  coverageYears: FieldExtraction;
  vehicleType: FieldExtraction & { comment?: string };
  extractionError: string | null;
};

type AIExtractionOutput = {
  metadata: { confidence_threshold: number };
  countries: Record<string, CountryAIExtraction>;
};

function main(): void {
  const threshold = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? '0.7');

  if (!fs.existsSync(AI_JSON_PATH)) {
    console.log(`Skipping merge: missing ${AI_JSON_PATH}. Run extract:guides:ai first.`);
    return;
  }

  const aiData = JSON.parse(fs.readFileSync(AI_JSON_PATH, 'utf-8')) as AIExtractionOutput;
  const roadFile = readText(ROAD_LINES_PATH);
  const geoFile = readText(GEO_HELPDESK_PATH);

  const roadBlock = findObjectBlock(roadFile, 'roadLinesData');
  const geoCamBlock = findObjectBlock(geoFile, 'cameraGenData');
  const geoCovBlock = findObjectBlock(geoFile, 'coverageYearsData');
  const geoColorBlock = findObjectBlock(geoFile, 'carColorData');
  const geoVehicleBlock = findObjectBlock(geoFile, 'vehicleTypeData');

  const roadExisting = extractExistingKeys(roadBlock.body);
  const geoCamExisting = extractExistingKeys(geoCamBlock.body);
  const geoCovExisting = extractExistingKeys(geoCovBlock.body);
  const geoColorExisting = extractExistingKeys(geoColorBlock.body);
  const geoVehicleExisting = extractExistingKeys(geoVehicleBlock.body);

  const roadEntries: Array<{ key: string; valueLiteral: string }> = [];
  const geoCamEntries: Array<{ key: string; valueLiteral: string }> = [];
  const geoCovEntries: Array<{ key: string; valueLiteral: string }> = [];
  const geoColorEntries: Array<{ key: string; valueLiteral: string }> = [];
  const geoVehicleEntries: Array<{ key: string; valueLiteral: string }> = [];

  let skippedBelowThreshold = 0;
  let skippedAlreadyExists = 0;

  for (const [countryName, data] of Object.entries(aiData.countries)) {
    if (data.extractionError) continue;

    // roadLines
    if (data.roadLines.confidence >= threshold && data.roadLines.values.length > 0) {
      if (roadExisting.has(countryName)) {
        skippedAlreadyExists++;
      } else {
        const cleaned = unique(
          (data.roadLines.values as string[])
            .map((v) => v.toLowerCase())
            .filter((v) => ROAD_LINE_ALLOWED.has(v))
        );
        if (cleaned.length > 0) {
          roadEntries.push({ key: countryName, valueLiteral: JSON.stringify(cleaned) });
        }
      }
    } else if (data.roadLines.values.length > 0) {
      skippedBelowThreshold++;
    }

    // cameraGen
    if (data.cameraGen.confidence >= threshold && data.cameraGen.values.length > 0) {
      if (geoCamExisting.has(countryName)) {
        skippedAlreadyExists++;
      } else {
        const cleaned = unique(
          (data.cameraGen.values as number[]).filter((n) => n >= 1 && n <= 4)
        ).sort((a, b) => a - b);
        if (cleaned.length > 0) {
          geoCamEntries.push({ key: countryName, valueLiteral: JSON.stringify(cleaned) });
        }
      }
    } else if (data.cameraGen.values.length > 0) {
      skippedBelowThreshold++;
    }

    // coverageYears
    if (data.coverageYears.confidence >= threshold && data.coverageYears.values.length > 0) {
      if (geoCovExisting.has(countryName)) {
        skippedAlreadyExists++;
      } else {
        const cleaned = unique(
          (data.coverageYears.values as number[]).filter((n) => n >= 2007 && n <= 2035)
        ).sort((a, b) => a - b);
        if (cleaned.length > 0) {
          geoCovEntries.push({ key: countryName, valueLiteral: JSON.stringify(cleaned) });
        }
      }
    } else if (data.coverageYears.values.length > 0) {
      skippedBelowThreshold++;
    }

    // carColor
    if (data.carColor.confidence >= threshold && data.carColor.values.length > 0) {
      if (geoColorExisting.has(countryName)) {
        skippedAlreadyExists++;
      } else {
        const cleaned = unique(
          (data.carColor.values as string[])
            .map((v) => v.toLowerCase().replace('grey', 'gray'))
            .filter((v) => CAR_COLOR_ALLOWED.has(v) && v !== 'other')
        );
        if (cleaned.length > 0) {
          geoColorEntries.push({ key: countryName, valueLiteral: JSON.stringify(cleaned) });
        }
      }
    } else if (data.carColor.values.length > 0) {
      skippedBelowThreshold++;
    }

    // vehicleType — "other" is review-only, never merged to data files
    if (data.vehicleType.confidence >= threshold && data.vehicleType.values.length > 0) {
      const values = data.vehicleType.values as string[];
      if (values.includes('other')) {
        // intentionally not merged; comment is visible in the review JSON
      } else if (geoVehicleExisting.has(countryName)) {
        skippedAlreadyExists++;
      } else {
        const pick = pickVehicleType(values);
        if (pick && pick !== 'other') {
          geoVehicleEntries.push({ key: countryName, valueLiteral: JSON.stringify(pick) });
        }
      }
    } else if (data.vehicleType.values.length > 0) {
      skippedBelowThreshold++;
    }
  }

  const updatedRoad = appendEntriesToExportObject(roadFile, 'roadLinesData', roadEntries);
  let updatedGeo = geoFile;
  updatedGeo = appendEntriesToExportObject(updatedGeo, 'cameraGenData', geoCamEntries);
  updatedGeo = appendEntriesToExportObject(updatedGeo, 'coverageYearsData', geoCovEntries);
  updatedGeo = appendEntriesToExportObject(updatedGeo, 'carColorData', geoColorEntries);
  updatedGeo = appendEntriesToExportObject(updatedGeo, 'vehicleTypeData', geoVehicleEntries);

  writeText(ROAD_LINES_PATH, updatedRoad);
  writeText(GEO_HELPDESK_PATH, updatedGeo);

  console.log(`AI merge (threshold=${threshold}):`);
  console.log(`  road-lines.ts roadLinesData: +${roadEntries.length} countries`);
  console.log(`  geo-car-helpdesk.ts cameraGenData: +${geoCamEntries.length} countries`);
  console.log(`  geo-car-helpdesk.ts coverageYearsData: +${geoCovEntries.length} countries`);
  console.log(`  geo-car-helpdesk.ts carColorData: +${geoColorEntries.length} countries`);
  console.log(`  geo-car-helpdesk.ts vehicleTypeData: +${geoVehicleEntries.length} countries`);
  console.log(`  Skipped (below threshold=${threshold}): ${skippedBelowThreshold} country-fields`);
  console.log(`  Skipped (already exists): ${skippedAlreadyExists} country-fields`);
}

main();
