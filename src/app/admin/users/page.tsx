'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { listUsers, deleteUserById } from '@/lib/api/users';
import type { User } from '@/types/user';

export default function AdminUsersPage() {
  const { status, isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      void router.replace('/login');
    } else if (status === 'authenticated' && !isAdmin) {
      void router.replace('/');
    }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) return;

    let cancelled = false;

    listUsers()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load users.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, isAdmin]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUserById(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError('Failed to delete user.');
    }
  }

  if (status !== 'authenticated' || !isAdmin) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold text-white">User management</h1>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-zinc-500">No users yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="pb-3 pr-6 font-medium">Email</th>
              <th className="pb-3 pr-6 font-medium">Role</th>
              <th className="pb-3 pr-6 font-medium">Joined</th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800/50">
                <td className="py-3 pr-6 text-zinc-200">{user.email}</td>
                <td className="py-3 pr-6 text-zinc-400">{user.role}</td>
                <td className="py-3 pr-6 text-zinc-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => void handleDelete(user.id)}
                    className="text-red-400 transition-colors hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
