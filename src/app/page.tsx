import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Starter App',
  description:
    'A full-stack application starter with accounts, member content, and administration.',
};

export default function HomePage() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Build what matters. <span className="text-blue-400">Start here.</span>
        </h1>
        <p className="max-w-xl text-lg text-zinc-400">
          A flexible foundation for your next application, with account access, member content, and
          administration ready to customize.
        </p>
        <div className="flex gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Create account
          </Link>
          <Link
            href="#about"
            className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Explore
          </Link>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold text-white">About this project</h2>
          <p className="text-zinc-400">
            This starter brings together a Next.js frontend and a NestJS API with authentication,
            protected member pages, and admin user management.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-2xl font-bold text-white">Project areas</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Member content',
                description: 'Create protected pages for signed-in users.',
              },
              {
                title: 'Authentication',
                description: 'Register, sign in, and restore sessions securely.',
              },
              {
                title: 'User administration',
                description: 'Manage accounts through role-protected endpoints.',
              },
              {
                title: 'API foundation',
                description: 'Extend the backend with your own application modules.',
              },
            ].map(({ title, description }) => (
              <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h3 className="mb-2 font-semibold text-white">{title}</h3>
                <p className="text-sm text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-2xl font-bold text-white">Get in touch</h2>
          <p className="mb-6 text-zinc-400">
            Questions or feedback? Send a note to the project contact.
          </p>
          <a
            href="mailto:hello@example.com"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Contact
          </a>
        </div>
      </section>
    </main>
  );
}
