import { IsString, MaxLength, Matches } from 'class-validator';
import { getUsefulMapsConfig } from '../../../config/useful-maps.config.js';

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const configuredBlobPrefix = getUsefulMapsConfig().blobPathPrefix.replace(/\/+$/, '');
const pathnamePrefixPattern = new RegExp(`^${escapeForRegex(configuredBlobPrefix)}/[a-z0-9/_-]+$`);

export class IssueUsefulMapUploadTicketDto {
  @IsString()
  @MaxLength(240)
  @Matches(pathnamePrefixPattern)
  pathnamePrefix!: string;
}
