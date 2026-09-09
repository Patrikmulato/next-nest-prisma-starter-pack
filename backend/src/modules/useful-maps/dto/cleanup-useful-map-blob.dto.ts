import { IsString, MaxLength, IsUrl } from 'class-validator';

export class CleanupUsefulMapBlobDto {
  @IsUrl({ require_tld: false })
  imageUrl!: string;

  @IsString()
  @MaxLength(260)
  blobPathname!: string;

  @IsString()
  @MaxLength(4096)
  uploadTicket!: string;
}
