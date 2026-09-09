'use client';

import { useEffect, useState } from 'react';
import {
  createSavedFilter,
  deleteSavedFilter,
  listMySavedFilters,
  updateSavedFilter,
} from '@/lib/api/saved-filters';
import { useAuth } from '@/lib/auth/AuthProvider';
import type { FilterRequest } from '@/types/map-data';
import type { SavedFilter } from '@/types/saved-filters';

type SavedFiltersPanelProps = {
  currentFilters: FilterRequest;
  onApply: (filters: FilterRequest) => void;
};

export default function SavedFiltersPanel({ currentFilters, onApply }: SavedFiltersPanelProps) {
  const { status } = useAuth();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let active = true;

    async function load() {
      try {
        const items = await listMySavedFilters();
        if (active) {
          setFilters(items);
        }
      } catch {
        if (active) {
          setError('Failed to load saved filters.');
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [status]);

  if (status !== 'authenticated') {
    return null;
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await createSavedFilter({
        name: trimmed,
        filters: currentFilters,
        isPublic,
      });
      setFilters((prev) => [created, ...prev]);
      setName('');
      setIsPublic(false);
    } catch {
      setError('Failed to save filter.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSavedFilter(id);
      setFilters((prev) => prev.filter((filter) => filter.id !== id));
    } catch {
      setError('Failed to delete filter.');
    }
  }

  async function handleRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    setError(null);
    try {
      const updated = await updateSavedFilter(id, { name: trimmed });
      setFilters((prev) => prev.map((filter) => (filter.id === id ? updated : filter)));
      setEditingId(null);
      setEditingName('');
    } catch {
      setError('Failed to rename filter.');
    }
  }

  return (
    <div id="saved-filters" className="mb-3 border-t border-zinc-800 pt-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Saved Filters
      </p>

      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name current filters"
          maxLength={80}
          className="rounded border border-zinc-700 bg-[#181c22] px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-3 w-3"
          />
          Make public
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save current filters'}
        </button>
      </div>

      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}

      {filters.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {filters.map((filter) => (
            <li key={filter.id} className="rounded bg-zinc-800/40 px-1.5 py-1">
              {editingId === filter.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    maxLength={80}
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-[#181c22] px-1.5 py-0.5 text-xs text-white outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(filter.id)}
                    className="text-[11px] text-green-400 hover:text-green-300"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onApply(filter.filters)}
                    title="Apply this filter"
                    className="min-w-0 flex-1 truncate text-left text-xs text-zinc-200 hover:text-white"
                  >
                    {filter.name}
                    {filter.isPublic && <span className="ml-1 text-[10px] text-blue-400">•</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(filter.id);
                      setEditingName(filter.name);
                    }}
                    title="Rename"
                    className="text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(filter.id)}
                    title="Delete"
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
