export type RoadLinePattern = string;

export type CarColor = string;
export type VehicleType = string;

export type MapDataResponse = {
  aliases: Record<string, string>;
  geoguessrCountries: string[];
  drivingSideData: Record<string, 'left' | 'right'>;
  roadLinesData: Record<string, RoadLinePattern[]>;
  linePatternLabels: Record<RoadLinePattern, string>;
  linePatternColors: Record<RoadLinePattern, string>;
  euPlateData: Record<string, boolean>;
  cameraGenData: Record<string, number[]>;
  coverageYearsData: Record<string, number[]>;
  carColorData: Record<string, CarColor[]>;
  vehicleTypeData: Record<string, VehicleType>;
  tooltipHtmlByCountry: Record<string, string>;
};

export type FilterRequest = {
  sideFilter: 'all' | 'left' | 'right';
  lineFilter: 'all' | RoadLinePattern;
  euPlateFilter: 'all' | 'yes' | 'no';
  cameraGenFilter: 'all' | string;
  coverageYearFilter: string;
  carColorFilter: 'all' | CarColor;
  vehicleTypeFilter: 'all' | VehicleType;
};

export type FilterResponse = {
  countries: string[];
};

// [lat, lng, colorIdx]  colorIdx: 1=black 2=blue 3=white 4=red 5=navy 6=grey 7=striped 8=white-blue
export type CarMetaCoord = [number, number, number];
export type CarMetaResponse = Record<string, CarMetaCoord[]>;
