'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { US_PLATES, PLATES_IMAGE_BASE } from '@/data/us-plates';
import type { USPlate } from '@/data/us-plates';
import { filterPlates, getHighlightedStates } from './filter';

const USMap = dynamic(() => import('@/components/USMap'), { ssr: false });

const COLORS = ['white', 'blue', 'green', 'yellow', 'red'] as const;

export default function USPlatesPage() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [colorFilters, setColorFilters] = useState<Set<string>>(new Set());

  function toggleColor(color: string) {
    setColorFilters((prev) => {
      const next = new Set(prev);
      if (next.has(color)) {
        next.delete(color);
      } else {
        next.add(color);
      }
      return next;
    });
  }

  const filteredPlates = useMemo<USPlate[]>(
    () => filterPlates(US_PLATES, colorFilters, selectedState),
    [colorFilters, selectedState]
  );

  const highlightedStates = useMemo<Set<string>>(
    () => getHighlightedStates(US_PLATES, colorFilters),
    [colorFilters]
  );

  function handleStateClick(state: string) {
    setSelectedState((prev) => (prev === state ? null : state));
  }

  function handlePlateClick(plate: USPlate) {
    setSelectedState((prev) => (prev === plate.state ? null : plate.state));
  }

  const stateLabel = selectedState
    ? `${selectedState} · ${filteredPlates.length} plate${filteredPlates.length !== 1 ? 's' : ''}`
    : `All states · ${filteredPlates.length} plates`;

  return (
    <div className="grid flex-1 min-h-0 overflow-hidden" style={{ gridTemplateColumns: '2fr 3fr' }}>
      {/* Left panel — 2/5 width */}
      <aside className="relative z-10 flex flex-col border-r border-zinc-800 bg-[#1e2530] min-w-0 overflow-hidden">
        <div className="border-b border-zinc-800 p-3">
          <h1 className="mb-2 text-sm font-bold text-white">US License Plates</h1>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setColorFilters(new Set())}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                colorFilters.size === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#2a3340] text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => toggleColor(color)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  colorFilters.has(color)
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#2a3340] text-slate-400 hover:text-slate-200'
                }`}
              >
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
          {stateLabel}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-4 gap-1.5">
            {filteredPlates.map((plate) => (
              <button
                key={plate.file}
                onClick={() => handlePlateClick(plate)}
                title={`${plate.state} — ${plate.label}`}
                className={`relative aspect-[2/1] overflow-hidden rounded bg-[#111827] transition-all ${
                  plate.state === selectedState
                    ? 'ring-2 ring-blue-500'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <Image
                  src={`${PLATES_IMAGE_BASE}${plate.file}`}
                  alt={plate.label}
                  fill
                  loading="eager"
                  sizes="160px"
                  className={`object-cover ${plate.file.startsWith('plate_last') ? 'object-bottom' : 'object-top'}`}
                />
              </button>
            ))}
          </div>
          {filteredPlates.length === 0 && (
            <p className="mt-8 text-center text-xs text-zinc-600">No plates match</p>
          )}
        </div>
      </aside>

      {/* Map — 3/5 width */}
      <div className="relative z-0 min-w-0 h-full overflow-hidden">
        <USMap
          selectedState={selectedState}
          highlightedStates={highlightedStates}
          onStateClick={handleStateClick}
        />
      </div>
    </div>
  );
}
