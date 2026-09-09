'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listPublicSavedFilters } from '@/lib/api/saved-filters';
import { useAuth } from '@/lib/auth/AuthProvider';
import { setPendingFilter } from '@/lib/saved-filters/pending-filter';
import type { SavedFilter } from '@/types/saved-filters';

const PAGE_SIZE = 20;

export default function PublicFiltersPage() {
  const router = useRouter();
  const { status } = useAuth();
  const [items, setItems] = useState<SavedFilter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPublicSavedFilters(targetPage, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch {
      setError('Failed to load public filters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load of the first page; loadPage owns the loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage(1);
  }, [loadPage]);

  function handleApply(filter: SavedFilter) {
    setPendingFilter(filter.filters);
    router.push('/');
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-lg font-bold text-white">Public Filters</h1>
        <p className="mb-4 text-sm text-zinc-400">
          Community-shared filter presets. Apply one to load it on the map.
        </p>
        {status === 'authenticated' && (
          <Link
            href="/#saved-filters"
            className="mb-4 inline-flex rounded border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Manage my saved filters
          </Link>
        )}

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">No public filters yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((filter) => (
              <li
                key={filter.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#20262e] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{filter.name}</p>
                  {filter.description && (
                    <p className="truncate text-xs text-zinc-400">{filter.description}</p>
                  )}
                  <p className="text-[11px] text-zinc-500">{filter.views} views</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApply(filter)}
                  className="ml-3 shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Apply
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => loadPage(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded border border-zinc-700 px-3 py-1 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => loadPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="rounded border border-zinc-700 px-3 py-1 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
