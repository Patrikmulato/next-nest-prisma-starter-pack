import { FilterRequestDto } from '../../data/dto/filter-request.dto.js';

export class SavedFilterDto {
  id!: string;
  userId!: string;
  name!: string;
  description?: string;
  filters!: FilterRequestDto;
  isPublic!: boolean;
  views!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedSavedFiltersDto {
  items!: SavedFilterDto[];
  total!: number;
  page!: number;
  limit!: number;
}
