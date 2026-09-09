import { Type } from 'class-transformer';
import { IsInt, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateUsefulMapDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(80)
  categorySlug!: string;

  @IsUrl({ require_tld: false })
  imageUrl!: string;

  @IsString()
  @MaxLength(260)
  blobPathname!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  @MaxLength(4096)
  uploadTicket!: string;
}
