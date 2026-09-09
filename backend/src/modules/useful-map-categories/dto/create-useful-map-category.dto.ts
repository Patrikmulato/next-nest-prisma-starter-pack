import { IsString, MaxLength, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUsefulMapCategoryDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;
}
