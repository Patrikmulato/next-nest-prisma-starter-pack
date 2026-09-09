import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Coach Patrik — Personal Training',
  description:
    'Work with Patrik to build strength, improve performance, and reach your fitness goals with personalized coaching.',
};

export default function HomePage() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Train smarter. <span className="text-blue-400">Get results.</span>
        </h1>
        <p className="max-w-xl text-lg text-zinc-400">
          Personalized coaching programs built around your goals, schedule, and lifestyle. No
          guesswork — just a clear plan and the support to follow it.
        </p>
        <div className="flex gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Get started
          </Link>
          <Link
            href="#about"
            className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Learn more
          </Link>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold text-white">About</h2>
          <p className="text-zinc-400">
            Hi, I&apos;m Patrik — a certified personal trainer focused on strength training and
            sustainable fitness. I work with clients at all levels to build programs that fit their
            real life, not just their ideal one.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-2xl font-bold text-white">What I offer</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: 'Strength programs',
                description: 'Progressive overload plans tailored to your level and equipment.',
              },
              {
                title: 'Nutrition guidance',
                description: 'Practical advice on fueling your training without obsessing over it.',
              },
              {
                title: 'Check-ins & adjustments',
                description: 'Regular reviews so your program evolves as you do.',
              },
              {
                title: 'Members area',
                description: 'Exclusive content, resources, and guides for clients.',
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
            Interested in working together? Reach out and I&apos;ll get back to you shortly.
          </p>
          <a
            href="mailto:patrik@example.com"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Contact me
          </a>
        </div>
      </section>
    </main>
  );
}
