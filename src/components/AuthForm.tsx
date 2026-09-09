'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import type { AuthUser } from '@/types/auth';

type AuthFormProps = {
  title: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => Promise<AuthUser>;
  footer: ReactNode;
  minPasswordLength?: number;
  passwordAutoComplete?: string;
};

export default function AuthForm({
  title,
  submitLabel,
  onSubmit,
  footer,
  minPasswordLength = 8,
  passwordAutoComplete = 'current-password',
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await onSubmit(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : err.message
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-[#20262e] p-6 shadow-lg">
        <h1 className="mb-4 text-lg font-bold text-white">{title}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-zinc-700 bg-[#181c22] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-300">
            Password
            <input
              type="password"
              required
              minLength={minPasswordLength}
              autoComplete={passwordAutoComplete}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded border border-zinc-700 bg-[#181c22] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <span className="text-xs text-zinc-500">At least {minPasswordLength} characters.</span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : submitLabel}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-zinc-400">{footer}</div>
      </div>
    </div>
  );
}
