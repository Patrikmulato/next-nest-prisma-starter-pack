import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

type CountryFilterEntry = {
  country: string;
  euLicencePlate?: boolean;
  coverageYears?: number[];
  cameraGenerations?: number[];
};

function extractObjectLiteral(source: string, constName: string): Record<string, unknown> {
  // Support both `const NAME = {` and `const _NAME = {` (underscore-prefixed private vars)
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`const\\s+_?${escapedName}\\s*=\\s*({[\\s\\S]*?});`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Unable to find ${constName} in source file`);
  }

  const objectLiteral = match[1];
  return vm.runInNewContext(`(${objectLiteral})`) as Record<string, unknown>;
}

function formatMap<T>(map: Record<string, T>, valueFormatter: (value: T) => string): string {
  const lines = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${valueFormatter(value)},`);
  return `\n${lines.join('\n')}\n`;
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const backendDir = path.resolve(scriptDir, '..');
  const defaultSourceDir = path.resolve(backendDir, '..', '..', 'GeoCarHelpDesk');
  const sourceDir = process.env.GEOCARHELPDESK_DIR
    ? path.resolve(process.env.GEOCARHELPDESK_DIR)
    : defaultSourceDir;

  const filtersDataPath = path.join(sourceDir, 'filters-data.js');
  const filtersPath = path.join(sourceDir, 'filters.js');
  const outputPath = path.join(backendDir, 'src', 'data', 'geo-car-helpdesk.ts');

  if (!fs.existsSync(filtersDataPath)) {
    throw new Error(`filters-data.js not found at: ${filtersDataPath}`);
  }
  if (!fs.existsSync(filtersPath)) {
    throw new Error(`filters.js not found at: ${filtersPath}`);
  }

  const filtersDataSource = fs.readFileSync(filtersDataPath, 'utf8');

  const context: { window: { COUNTRY_FILTER_DATA?: CountryFilterEntry[] } } = {
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(filtersDataSource, context);

  const entries = context.window.COUNTRY_FILTER_DATA;
  if (!Array.isArray(entries)) {
    throw new Error('window.COUNTRY_FILTER_DATA missing or invalid');
  }

  const carColorDataRaw = extractObjectLiteral(filtersDataSource, 'carColors');
  const vehicleTypeDataRaw = extractObjectLiteral(filtersDataSource, 'vehicleType');

  const euPlateData: Record<string, boolean> = {};
  const cameraGenData: Record<string, number[]> = {};
  const coverageYearsData: Record<string, number[]> = {};

  for (const entry of entries) {
    euPlateData[entry.country] = Boolean(entry.euLicencePlate);
    cameraGenData[entry.country] = (entry.cameraGenerations ?? []).map(Number);
    coverageYearsData[entry.country] = (entry.coverageYears ?? []).map(Number);
  }

  const carColorData = carColorDataRaw as Record<string, string[]>;
  const vehicleTypeData = vehicleTypeDataRaw as Record<string, string>;

  const cameraGens = new Set<number>([1, 2, 3, 4]);
  Object.values(cameraGenData).forEach((gens) => gens.forEach((g) => cameraGens.add(g)));
  const cameraGenType = Array.from(cameraGens)
    .sort((a, b) => a - b)
    .join(' | ');

  const carColors = new Set<string>(['white']);
  Object.values(carColorData).forEach((colors) => colors.forEach((c) => carColors.add(c)));
  const carColorType = Array.from(carColors)
    .sort((a, b) => a.localeCompare(b))
    .map((c) => JSON.stringify(c))
    .join(' | ');

  const vehicleTypes = new Set<string>(['car']);
  Object.values(vehicleTypeData).forEach((v) => vehicleTypes.add(v));
  const vehicleTypeType = Array.from(vehicleTypes)
    .sort((a, b) => a.localeCompare(b))
    .map((v) => JSON.stringify(v))
    .join(' | ');

  const output = `// Auto-generated from GeoCarHelpDesk/filters-data.js and GeoCarHelpDesk/filters.js\n// Do not edit by hand. Run: pnpm --filter geoguessr-helper-backend sync:data\n\nexport type CameraGen = ${cameraGenType};\nexport type CarColor = ${carColorType};\nexport type VehicleType = ${vehicleTypeType};\n\n/** Whether a country uses the EU-style blue side-strip licence plate. */\nexport const euPlateData: Record<string, boolean> = {${formatMap(
    euPlateData,
    (v) => `${v}`
  )}};\n\n/** Camera generations available in a country. Empty array = no data. */\nexport const cameraGenData: Record<string, CameraGen[]> = {${formatMap(
    cameraGenData,
    (v) => `[${v.join(', ')}]`
  )}};\n\n/** Years in which a country had Google Street View coverage updates. */\nexport const coverageYearsData: Record<string, number[]> = {${formatMap(
    coverageYearsData,
    (v) => `[${v.join(', ')}]`
  )}};\n\n/** Countries with non-white or mixed car colors. */\nexport const carColorData: Record<string, CarColor[]> = {${formatMap(
    carColorData,
    (v) => `[${v.map((c) => JSON.stringify(c)).join(', ')}]`
  )}};\n\n/** Countries using a non-car Google Street View vehicle. */\nexport const vehicleTypeData: Record<string, VehicleType> = {${formatMap(
    vehicleTypeData,
    (v) => JSON.stringify(v)
  )}};\n\nexport function getEuPlate(country: string): boolean | null {\n  return country in euPlateData ? euPlateData[country] : null;\n}\n\nexport function getCameraGens(country: string): CameraGen[] {\n  return cameraGenData[country] ?? [];\n}\n\nexport function getCoverageYears(country: string): number[] {\n  return coverageYearsData[country] ?? [];\n}\n\nexport function getCarColors(country: string): CarColor[] {\n  return carColorData[country] ?? ['white'];\n}\n\nexport function getVehicleType(country: string): VehicleType {\n  return vehicleTypeData[country] ?? 'car';\n}\n`;

  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`Synced ${entries.length} countries from ${filtersDataPath} -> ${outputPath}`);
}

main();
