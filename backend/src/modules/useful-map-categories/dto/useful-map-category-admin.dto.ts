import { UsefulMapCategoryDto } from '../../useful-maps/dto/useful-map-category.dto.js';

export class UsefulMapCategoryAdminDto extends UsefulMapCategoryDto {
  mapCount!: number;
}

export class UsefulMapCategoryMutationResponseDto {
  id!: string;
  deleted!: true;
}
