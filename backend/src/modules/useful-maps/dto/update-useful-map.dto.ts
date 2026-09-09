import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class UpdateUsefulMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categorySlug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  blobPathname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  uploadTicket?: string;
}
