'use client';

import { useEffect, useState } from 'react';
import UsefulMapsGallery from '@/components/UsefulMapsGallery';
import UsefulMapsSidebar from '@/components/UsefulMapsSidebar';
import { listPublicUsefulMaps, listUsefulMapCategories } from '@/lib/api/useful-maps';
import type { UsefulMapCategory, UsefulMapSummary } from '@/types/useful-maps';
import { useAuth, useAuthDependentEffect } from '@/lib/auth/AuthProvider';

const SCROLL_CONTAINER_ID = 'useful-maps-scroll';
const PAGE_SIZE = 12;

function formatCategoryLabel(category: string): string {
  if (category === 'all') {
    return 'All';
  }

  return category
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function UsefulMapsBrowser() {
  const [categories, setCategories] = useState<UsefulMapCategory[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [items, setItems] = useState<UsefulMapSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();

  useAuthDependentEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const categoryList = await listUsefulMapCategories({ onlyWithImages: !isAdmin });
        if (active) {
          setCategories(categoryList);
        }
      } catch {
        if (active) {
          setError('Failed to load useful map categories.');
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    let active = true;

    async function loadFirstPage() {
      try {
        const result = await listPublicUsefulMaps({
          categorySlug: selectedCategorySlug === 'all' ? undefined : selectedCategorySlug,
          page: 1,
          limit: PAGE_SIZE,
        });

        if (!active) {
          return;
        }

        setItems(result.items);
        setTotal(result.total);
      } catch {
        if (active) {
          setError('Failed to load useful maps.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFirstPage();

    return () => {
      active = false;
    };
  }, [selectedCategorySlug]);

  const hasMore = items.length < total;

  function handleCategoryChange(nextCategorySlug: string) {
    if (nextCategorySlug === selectedCategorySlug) {
      return;
    }

    setLoading(true);
    setError(null);
    setItems([]);
    setPage(1);
    setSelectedCategorySlug(nextCategorySlug);
  }

  async function handleLoadMore() {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const result = await listPublicUsefulMaps({
        categorySlug: selectedCategorySlug === 'all' ? undefined : selectedCategorySlug,
        page: nextPage,
        limit: PAGE_SIZE,
      });

      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setTotal(result.total);
    } catch {
      setError('Failed to load more useful maps.');
    } finally {
      setLoadingMore(false);
    }
  }

  const displayCategories = [
    { id: 'all', slug: 'all', label: 'All', createdAt: '', updatedAt: '' },
    ...categories,
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[#181c22] text-white">
      <UsefulMapsSidebar
        items={items.map(({ id, title, imageUrl }) => ({ id, title, src: imageUrl }))}
        scrollContainerId={SCROLL_CONTAINER_ID}
      />

      <main id={SCROLL_CONTAINER_ID} className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#181c22]/95 px-4 py-3 backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {displayCategories.map((category) => {
              const isActive = selectedCategorySlug === category.slug;

              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => handleCategoryChange(category.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                      : 'border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {formatCategoryLabel(category.label || category.slug)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-zinc-400">
            <p>
              {loading
                ? 'Loading useful maps...'
                : (error ?? (isAdmin && `${items.length} of ${total} maps loaded`))}
            </p>
            {hasMore && !loading && (
              <button
                type="button"
                onClick={() => {
                  void handleLoadMore();
                }}
                disabled={loadingMore}
                className="rounded-md border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? 'Loading more…' : 'Load more'}
              </button>
            )}
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="px-4 py-10 text-center text-zinc-500">Loading useful maps…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-zinc-500">
            No useful maps found for this category.
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-4">
            <UsefulMapsGallery
              items={items.map(({ id, title, imageUrl }) => ({ id, title, src: imageUrl }))}
            />

            {hasMore && (
              <div className="flex justify-center pb-4">
                <button
                  type="button"
                  onClick={() => {
                    void handleLoadMore();
                  }}
                  disabled={loadingMore}
                  className="rounded-md border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Loading more…' : 'Load more useful maps'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
