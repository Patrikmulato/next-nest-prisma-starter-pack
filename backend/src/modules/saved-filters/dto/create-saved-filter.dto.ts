import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FilterRequestDto } from '../../data/dto/filter-request.dto.js';

export class CreateSavedFilterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterRequestDto)
  filters!: FilterRequestDto;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
