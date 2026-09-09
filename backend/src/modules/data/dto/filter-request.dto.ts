import { IsIn, IsString, Matches } from 'class-validator';
import {
  cameraGenData,
  carColorData,
  vehicleTypeData,
  type CarColor,
  type VehicleType,
} from '../../../data/geo-car-helpdesk.js';
import { linePatternLabels } from '../../../data/road-lines.js';

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

export const ROAD_LINE_PATTERNS = ['all', ...Object.keys(linePatternLabels)];

export const CAMERA_GEN_FILTERS = [
  'all',
  ...unique(
    Object.values(cameraGenData)
      .flat()
      .map((v) => String(v))
  ).sort((a, b) => Number(a) - Number(b)),
];

export const CAR_COLOR_FILTERS = unique(['all', 'white', ...Object.values(carColorData).flat()]);

export const VEHICLE_TYPE_FILTERS = unique(['all', 'car', ...Object.values(vehicleTypeData)]);

type CameraGenFilter = 'all' | `${1 | 2 | 3 | 4}`;

export class FilterRequestDto {
  @IsIn(['all', 'left', 'right'])
  sideFilter!: 'all' | 'left' | 'right';

  @IsString()
  @IsIn(ROAD_LINE_PATTERNS)
  lineFilter!: string;

  @IsIn(['all', 'yes', 'no'])
  euPlateFilter!: 'all' | 'yes' | 'no';

  @IsIn(CAMERA_GEN_FILTERS)
  cameraGenFilter!: CameraGenFilter;

  @IsString()
  @Matches(/^(all|\d{4})$/)
  coverageYearFilter!: string;

  @IsIn(CAR_COLOR_FILTERS)
  carColorFilter!: 'all' | CarColor;

  @IsIn(VEHICLE_TYPE_FILTERS)
  vehicleTypeFilter!: 'all' | VehicleType;
}
