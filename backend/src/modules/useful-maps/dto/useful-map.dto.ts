import { UsefulMapCategoryDto } from './useful-map-category.dto.js';

export class UsefulMapDto {
  id!: string;
  title!: string;
  category!: UsefulMapCategoryDto;
  imageUrl!: string;
  sizeBytes!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedUsefulMapsDto {
  items!: UsefulMapDto[];
  total!: number;
  page!: number;
  limit!: number;
}
