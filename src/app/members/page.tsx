'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const CONTENT_PAGES: { slug: string; title: string; description: string }[] = [
  // Add content pages here as you create them, e.g.:
  // { slug: 'training-principles', title: 'Training Principles', description: 'The fundamentals behind every program.' },
];

export default function MembersPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      void router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-4 text-3xl font-bold text-white">Members area</h1>
      <p className="mb-12 text-zinc-400">
        Welcome. Here you&apos;ll find your training resources and guides.
      </p>

      {CONTENT_PAGES.length === 0 ? (
        <p className="text-zinc-500">Content coming soon.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {CONTENT_PAGES.map(({ slug, title, description }) => (
            <li key={slug}>
              <Link
                href={`/members/${slug}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-600"
              >
                <h2 className="mb-1 font-semibold text-white">{title}</h2>
                <p className="text-sm text-zinc-400">{description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
