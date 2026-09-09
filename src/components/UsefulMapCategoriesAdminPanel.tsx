'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  createUsefulMapCategory,
  deleteUsefulMapCategory,
  updateUsefulMapCategory,
} from '@/lib/api/useful-map-categories';
import { slugify } from '@/lib/slugify';
import type { UsefulMapCategoryAdmin, CreateUsefulMapCategoryPayload } from '@/types/useful-maps';

type EditDraft = {
  label: string;
};

export default function UsefulMapCategoriesAdminPanel({
  categories,
  onChanged,
}: {
  categories: UsefulMapCategoryAdmin[];
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  function handleLabelChange(value: string) {
    setLabel(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugTouched(true);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!label.trim() || !slug.trim()) {
      setError('Label and slug are required.');
      return;
    }

    setCreating(true);
    setError(null);
    setStatusMessage(null);

    try {
      const payload: CreateUsefulMapCategoryPayload = {
        label: label.trim(),
        slug: slug.trim(),
      };
      await createUsefulMapCategory(payload);
      setLabel('');
      setSlug('');
      setSlugTouched(false);
      setStatusMessage('Category created successfully.');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category.');
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(item: UsefulMapCategoryAdmin) {
    setEditingId(item.id);
    setEditDraft({ label: item.label });
    setStatusMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function handleSaveEdit(item: UsefulMapCategoryAdmin) {
    if (!editDraft) {
      return;
    }

    if (!editDraft.label.trim()) {
      setError('Label is required.');
      return;
    }

    setError(null);
    setStatusMessage(null);

    try {
      await updateUsefulMapCategory(item.id, { label: editDraft.label.trim() });
      setEditingId(null);
      setEditDraft(null);
      setStatusMessage('Category updated.');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category.');
    }
  }

  async function handleDelete(item: UsefulMapCategoryAdmin) {
    const confirmed = window.confirm(`Delete "${item.label}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError(null);
    setStatusMessage(null);

    try {
      await deleteUsefulMapCategory(item.id);
      setStatusMessage('Category deleted.');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-[#12161b] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Useful Map Categories</h2>
          <p className="text-sm text-zinc-400">
            Create and manage categories for organizing useful maps
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await onChanged();
          }}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {statusMessage && <p className="mb-3 text-sm text-emerald-400">{statusMessage}</p>}

      <form onSubmit={(e) => void handleCreateSubmit(e)} className="mb-6 grid gap-3 md:grid-cols-3">
        <input
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Category label"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
        />
        <input
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="Slug (auto-derived)"
          className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Create category'}
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No categories yet. Create one above to start uploading maps.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#20262e] text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Label</th>
                <th className="px-4 py-2 font-semibold">Slug</th>
                <th className="px-4 py-2 font-semibold">Maps</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) =>
                editingId === category.id && editDraft ? (
                  <tr key={category.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2">
                      <input
                        value={editDraft.label}
                        onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                        className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-zinc-500" title="Slug cannot be changed">
                      {category.slug}
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{category.mapCount}</td>
                    <td className="flex justify-end gap-2 px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveEdit(category);
                        }}
                        className="rounded border border-emerald-600/60 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded border border-zinc-600 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-500/10"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={category.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2 text-zinc-200">{category.label}</td>
                    <td className="px-4 py-2 text-zinc-500">{category.slug}</td>
                    <td className="px-4 py-2 text-zinc-400">{category.mapCount}</td>
                    <td className="flex justify-end gap-2 px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => beginEdit(category)}
                        className="rounded border border-blue-600/60 px-2.5 py-1 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-500 hover:bg-blue-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(category);
                        }}
                        disabled={deletingId === category.id || category.mapCount > 0}
                        title={
                          category.mapCount > 0
                            ? 'Cannot delete categories with attached maps'
                            : undefined
                        }
                        className="rounded border border-red-600/60 px-2.5 py-1 text-xs font-semibold text-red-300 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600"
                      >
                        {deletingId === category.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
