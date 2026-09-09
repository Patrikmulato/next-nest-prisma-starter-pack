'use client';

import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import {
  cleanupUsefulMapBlob,
  createUsefulMap,
  deleteUsefulMap,
  issueUsefulMapUploadTicket,
  listAdminUsefulMaps,
  retryUsefulMapBlobCleanup,
  updateUsefulMap,
} from '@/lib/api/useful-maps';
import { slugify } from '@/lib/slugify';
import type { UsefulMapAdmin, UsefulMapCategory } from '@/types/useful-maps';

const PAGE_SIZE = 12;

function extensionFromFile(file: File): string {
  const fromName = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  if (fromName) {
    return fromName;
  }

  if (file.type === 'image/jpeg') return '.jpg';
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/webp') return '.webp';
  if (file.type === 'image/gif') return '.gif';
  if (file.type === 'image/avif') return '.avif';

  return '.bin';
}

type EditDraft = {
  title: string;
  categorySlug: string;
};

export default function UsefulMapsAdminPanel({
  categories,
  onCategoriesStale,
  categoriesLoading = false,
}: {
  categories: UsefulMapCategory[];
  onCategoriesStale: () => Promise<void>;
  categoriesLoading?: boolean;
}) {
  const [maps, setMaps] = useState<UsefulMapAdmin[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [retryingCleanup, setRetryingCleanup] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const [title, setTitle] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function refreshFirstPage() {
    setLoading(true);
    setError(null);

    try {
      const result = await listAdminUsefulMaps({ page: 1, limit: PAGE_SIZE });
      setMaps(result.items);
      setTotal(result.total);
      setPage(1);
      await onCategoriesStale();
    } catch {
      setError('Failed to load useful maps admin data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const result = await listAdminUsefulMaps({ page: 1, limit: PAGE_SIZE });

        if (!active) {
          return;
        }

        setMaps(result.items);
        setTotal(result.total);
        setPage(1);
      } catch {
        if (active) {
          setError('Failed to load useful maps admin data.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, []);

  const hasMore = maps.length < total;

  async function handleLoadMore() {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const result = await listAdminUsefulMaps({ page: nextPage, limit: PAGE_SIZE });
      setMaps((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setTotal(result.total);
    } catch {
      setError('Failed to load more useful maps.');
    } finally {
      setLoadingMore(false);
    }
  }

  function beginEdit(item: UsefulMapAdmin) {
    setEditingId(item.id);
    setEditDraft({ title: item.title, categorySlug: item.category.slug });
    setStatusMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError('Select an image file to upload.');
      return;
    }

    if (!title.trim() || !categorySlug.trim()) {
      setError('Title and category are required.');
      return;
    }

    setCreating(true);
    setError(null);
    setStatusMessage(null);
    setUploadProgress(0);

    const cleanedTitle = slugify(title);
    const pathnamePrefix = `useful-maps/${categorySlug.trim()}/${cleanedTitle}-${Date.now()}`;
    const pathname = `${pathnamePrefix}${extensionFromFile(file)}`;

    try {
      const ticket = await issueUsefulMapUploadTicket({ pathnamePrefix });
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/useful-maps/upload',
        clientPayload: JSON.stringify({
          uploadTicket: ticket.ticket,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
        contentType: file.type,
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(percentage);
        },
      });

      try {
        await createUsefulMap({
          title: title.trim(),
          categorySlug: categorySlug.trim(),
          imageUrl: blob.url,
          blobPathname: blob.pathname,
          mimeType: blob.contentType ?? file.type,
          sizeBytes: file.size,
          uploadTicket: ticket.ticket,
        });
      } catch (createError) {
        await cleanupUsefulMapBlob({
          imageUrl: blob.url,
          blobPathname: blob.pathname,
          uploadTicket: ticket.ticket,
        }).catch(() => undefined);
        throw createError;
      }

      setTitle('');
      setCategorySlug('');
      setFile(null);
      setUploadProgress(null);
      setStatusMessage('Useful map uploaded successfully.');
      await refreshFirstPage();
    } catch {
      setError('Failed to upload useful map.');
      setUploadProgress(null);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(item: UsefulMapAdmin) {
    if (!editDraft) {
      return;
    }

    setError(null);
    setStatusMessage(null);

    try {
      await updateUsefulMap(item.id, {
        title: editDraft.title.trim(),
        categorySlug: editDraft.categorySlug,
      });
      setEditingId(null);
      setEditDraft(null);
      setStatusMessage('Useful map updated.');
      await refreshFirstPage();
    } catch {
      setError('Failed to update useful map.');
    }
  }

  async function handleDelete(item: UsefulMapAdmin) {
    const confirmed = window.confirm(
      `Delete ${item.title}? This will remove the blob and the record.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError(null);
    setStatusMessage(null);

    try {
      await deleteUsefulMap(item.id);
      setStatusMessage('Useful map deleted.');
      await refreshFirstPage();
    } catch {
      setError('Failed to delete useful map.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRetryBlobCleanup() {
    setRetryingCleanup(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await retryUsefulMapBlobCleanup();
      setStatusMessage(
        `Blob cleanup retry finished: retried ${result.retried}, deleted ${result.deleted}, failed ${result.failed}, remaining ${result.remaining}.`
      );
    } catch {
      setError('Failed to retry blob cleanup.');
    } finally {
      setRetryingCleanup(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#12161b] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Useful Maps</h2>
          <p className="text-sm text-zinc-400">Admin-managed gallery and Blob upload flow.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void handleRetryBlobCleanup();
            }}
            disabled={retryingCleanup}
            className="rounded-md border border-amber-600/70 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-500 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retryingCleanup ? 'Retrying cleanup…' : 'Retry blob cleanup'}
          </button>
          <button
            type="button"
            onClick={() => {
              void refreshFirstPage();
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {!categoriesLoading && categories.length === 0 && (
        <p className="mb-3 text-sm text-red-400">Create a category below before uploading.</p>
      )}
      {statusMessage && <p className="mb-3 text-sm text-emerald-400">{statusMessage}</p>}

      <form
        onSubmit={(event) => void handleCreateSubmit(event)}
        className="mb-6 grid gap-3 md:grid-cols-4"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Map title"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500 md:col-span-2"
        />
        <select
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <div className="flex items-center gap-3 md:col-span-4">
          <button
            type="submit"
            disabled={creating || (!categoriesLoading && categories.length === 0)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Uploading…' : 'Upload useful map'}
          </button>
          {uploadProgress !== null && (
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                <span>Upload progress</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width]"
                  style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading useful maps…</p>
      ) : maps.length === 0 ? (
        <p className="text-sm text-zinc-500">No useful maps yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#20262e] text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Title</th>
                <th className="px-4 py-2 font-semibold">Category</th>
                <th className="px-4 py-2 font-semibold">Image</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {maps.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} className="border-t border-zinc-800 align-top">
                    <td className="px-4 py-3 text-zinc-200">
                      {isEditing && editDraft ? (
                        <input
                          value={editDraft.title}
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current ? { ...current, title: event.target.value } : current
                            )
                          }
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        />
                      ) : (
                        item.title
                      )}
                      <div className="mt-1 text-xs text-zinc-500">{item.blobPathname}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {isEditing && editDraft ? (
                        <select
                          value={editDraft.categorySlug}
                          onChange={(event) =>
                            setEditDraft((current) =>
                              current ? { ...current, categorySlug: event.target.value } : current
                            )
                          }
                          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.slug}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.category.label
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      <a
                        href={item.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(item)}
                            className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-semibold text-blue-200 transition-colors hover:bg-blue-600/15"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => beginEdit(item)}
                            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="rounded-md border border-red-600/60 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === item.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              void handleLoadMore();
            }}
            disabled={loadingMore}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Loading more…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  );
}
