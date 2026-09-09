import type { Metadata } from 'next';
import UsefulMapsBrowser from '@/components/UsefulMapsBrowser';

export const metadata: Metadata = {
  title: 'Useful Maps — GeoGuessr Helper',
};

export default function UsefulMapsPage() {
  return <UsefulMapsBrowser />;
}
