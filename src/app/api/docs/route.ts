import { redirect } from 'next/navigation';
import { config } from '@/config';

export function GET(): never {
  redirect(`${config.apiBaseUrl}/api/docs`);
}
