'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownGroup<T extends string> {
  label: string;
  options: DropdownOption<T>[];
}

interface FilterDropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  placeholder: string;
  options?: DropdownOption<T>[];
  groups?: DropdownGroup<T>[];
  openDirection?: 'down' | 'right';
}

export default function FilterDropdown<T extends string>({
  value,
  onChange,
  placeholder,
  options,
  groups,
  openDirection = 'down',
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Calculate panel position based on button position with viewport constraints
  const updatePanelPosition = useCallback(() => {
    if (!open || !buttonRef.current) {
      setPanelPos(null);
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const padding = 8;
    const maxDropdownHeight = 300;
    const maxDropdownWidth = 300;

    let top: number;
    let left: number;

    if (openDirection === 'right') {
      // Open to the right
      top = rect.top;
      left = rect.right + 6;

      // If goes off right, shift left
      if (left + maxDropdownWidth > window.innerWidth - padding) {
        left = window.innerWidth - maxDropdownWidth - padding;
      }
    } else {
      // Open downward (default)
      top = rect.bottom + 4;
      left = rect.left;

      // If goes off bottom, show above button
      if (top + maxDropdownHeight > window.innerHeight) {
        top = rect.top - maxDropdownHeight - 4;
      }

      // If goes off right, shift left
      if (left + maxDropdownWidth > window.innerWidth - padding) {
        left = window.innerWidth - maxDropdownWidth - padding;
      }
    }

    setPanelPos({ top, left });
  }, [open, openDirection]);

  useEffect(() => {
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  // Recalculate position on scroll
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => updatePanelPosition();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [open, updatePanelPosition]);

  // Resolve display label
  const allOptions = options ?? groups?.flatMap((g) => g.options) ?? [];
  const selected = allOptions.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const handleSelect = (val: T) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="w-full">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none transition-colors hover:border-zinc-600 focus:border-blue-500"
      >
        <span>{displayLabel}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && panelPos && (
        <div
          ref={panelRef}
          className="fixed z-[9999] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          style={{
            top: `${panelPos.top}px`,
            left: `${panelPos.left}px`,
            maxHeight: `calc(100vh - ${panelPos.top + 8}px)`,
            minWidth: '160px',
            maxWidth: '320px',
          }}
        >
          {options &&
            options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`block w-full whitespace-nowrap px-4 py-1.5 text-left text-sm transition-colors ${
                  value === opt.value ? 'bg-blue-600 text-white' : 'text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {opt.label}
              </button>
            ))}

          {groups &&
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group.label}
                </div>
                {group.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`block w-full whitespace-nowrap px-4 py-1.5 text-left text-sm transition-colors ${
                      value === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
