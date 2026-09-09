// Shared types for the GeoGuessr Helper app
// These types should mirror the DTOs from the NestJS backend

export interface Hint {
  id: string;
  category: HintCategory;
  title: string;
  description: string;
  countries: string[];
  imageUrl?: string;
}

export type HintCategory =
  | 'driving-side'
  | 'road-markings'
  | 'license-plates'
  | 'language'
  | 'landscape'
  | 'camera'
  | 'bollards'
  | 'signs'
  | 'vehicles'
  | 'utilities';

export interface Country {
  code: string;
  name: string;
  region: string;
  drivingSide: 'left' | 'right';
}
