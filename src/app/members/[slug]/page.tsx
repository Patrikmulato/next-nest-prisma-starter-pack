'use client';

import { notFound } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

// Register content pages here. Each file can be a simple object with a title and JSX body.
const PAGES: Record<string, { title: string; body: React.ReactNode }> = {
  // 'training-principles': {
  //   title: 'Training Principles',
  //   body: <p>...</p>,
  // },
};

export default function MembersContentPage({ params }: { params: { slug: string } }) {
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

  const page = PAGES[params.slug];
  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold text-white">{page.title}</h1>
      <div className="prose prose-invert max-w-none text-zinc-300">{page.body}</div>
    </main>
  );
}
