'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AuthForm from '@/components/AuthForm';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { login, status, isAdmin } = useAuth();

  // Single role-aware redirect once authenticated (covers both fresh logins and
  // already-authenticated visits) to avoid competing navigations.
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(isAdmin ? '/dashboard' : '/');
    }
  }, [status, isAdmin, router]);

  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={async (email, password) => {
        return login(email, password);
      }}
      footer={
        <span>
          Need an account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">
            Register
          </Link>
        </span>
      }
    />
  );
}
