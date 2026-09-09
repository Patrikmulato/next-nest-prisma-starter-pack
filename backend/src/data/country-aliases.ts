/**
 * Maps GeoJSON ADMIN names to the names used in our data files.
 * Only entries that differ need to be listed.
 */
export const geoJsonNameAliases: Record<string, string> = {
  'United States of America': 'United States',
  'The Bahamas': 'Bahamas',
  'Republic of Serbia': 'Serbia',
  eSwatini: 'Eswatini',
  'United Republic of Tanzania': 'Tanzania',
  Vatican: 'Vatican City',
  'South Georgia and the Islands': 'South Georgia and the South Sandwich Islands',
  Aland: 'Åland',
  'São Tomé and Principe': 'São Tomé and Príncipe',
  'Saint Barthelemy': 'Saint Barthélemy',
  Somaliland: 'Somalia',
  'Northern Cyprus': 'Cyprus',
};

export function resolveCountryName(geoJsonName: string): string {
  return geoJsonNameAliases[geoJsonName] ?? geoJsonName;
}
