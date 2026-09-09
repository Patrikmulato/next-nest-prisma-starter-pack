'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUserById, listUsers } from '@/lib/api/users';
import { listAdminUsefulMapCategories } from '@/lib/api/useful-map-categories';
import { useAuth } from '@/lib/auth/AuthProvider';
import UsefulMapsAdminPanel from '@/components/UsefulMapsAdminPanel';
import UsefulMapCategoriesAdminPanel from '@/components/UsefulMapCategoriesAdminPanel';
import type { User } from '@/types/user';
import type { UsefulMapCategoryAdmin } from '@/types/useful-maps';

export default function DashboardPage() {
  const router = useRouter();
  const { status, isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<UsefulMapCategoryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Send unauthenticated visitors to the login route.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Load users only for authenticated admins.
  useEffect(() => {
    if (status !== 'authenticated' || !isAdmin) {
      return;
    }

    let active = true;

    async function load() {
      try {
        const [userList, categoryList] = await Promise.all([
          listUsers(),
          listAdminUsefulMapCategories(),
        ]);
        if (active) {
          setUsers(userList);
          setCategories(categoryList);
        }
      } catch {
        if (active) {
          setError('Failed to load data.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [status, isAdmin]);

  async function refreshCategories() {
    setError(null);
    try {
      const categoryList = await listAdminUsefulMapCategories();
      setCategories(categoryList);
    } catch {
      setError('Failed to refresh categories.');
    }
  }

  if (status === 'loading') {
    return <div className="flex flex-1 items-center justify-center text-zinc-500">Loading…</div>;
  }

  if (status === 'authenticated' && !isAdmin) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-3xl font-bold text-white">403</p>
        <p className="text-sm text-zinc-400">You are not authorized to view this page.</p>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  async function handleDeleteUser(targetUser: User) {
    if (targetUser.id === currentUser?.id) {
      setError('You cannot delete your own account.');
      return;
    }

    const confirmed = window.confirm(`Delete user ${targetUser.email}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(targetUser.id);
    setError(null);
    try {
      await deleteUserById(targetUser.id);
      setUsers((prev) => prev.filter((user) => user.id !== targetUser.id));
    } catch {
      setError('Failed to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-lg font-bold text-white">Dashboard</h1>
        <p className="mb-4 text-sm text-zinc-400">Registered users (admin only).</p>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading users…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#20262e] text-xs uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Joined</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2 text-zinc-200">{user.email}</td>
                    <td className="px-4 py-2 text-zinc-300">{user.role}</td>
                    <td className="px-4 py-2 text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteUser(user);
                        }}
                        disabled={deletingUserId === user.id || user.id === currentUser?.id}
                        className="rounded border border-red-600/60 px-2.5 py-1 text-xs font-semibold text-red-300 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600"
                      >
                        {deletingUserId === user.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <UsefulMapsAdminPanel
          categories={categories}
          onCategoriesStale={refreshCategories}
          categoriesLoading={loading}
        />
        <UsefulMapCategoriesAdminPanel categories={categories} onChanged={refreshCategories} />
      </div>
    </div>
  );
}
