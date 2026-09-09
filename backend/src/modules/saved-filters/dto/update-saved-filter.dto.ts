import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FilterRequestDto } from '../../data/dto/filter-request.dto.js';

export class UpdateSavedFilterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  // ValidateIf (rather than IsOptional) so an explicit `null` is still rejected;
  // only a genuinely absent property skips validation.
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => FilterRequestDto)
  filters?: FilterRequestDto;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
