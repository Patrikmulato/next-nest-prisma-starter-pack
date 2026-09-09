'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { register, status, isAdmin } = useAuth();

  // Single role-aware redirect once authenticated (covers both fresh registrations
  // and already-authenticated visits) to avoid competing navigations.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(isAdmin ? '/dashboard' : '/');
    }
  }, [status, isAdmin, router]);

  return (
    <AuthForm
      title="Create an account"
      submitLabel="Register"
      passwordAutoComplete="new-password"
      onSubmit={async (email, password) => {
        return register(email, password);
      }}
      footer={
        <span>
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Log in
          </Link>
        </span>
      }
    />
  );
}
