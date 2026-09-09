import { SetMetadata } from '@nestjs/common';

export const API_RESPONSE_MESSAGE_KEY = 'api:response:message';

export function ApiResponseMessage(message: string) {
  return SetMetadata(API_RESPONSE_MESSAGE_KEY, message);
}
