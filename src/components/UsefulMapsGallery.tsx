'use client';

import Image from 'next/image';
import { useRef, useState, useCallback, useEffect } from 'react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  id: string;
  title: string;
}

function ZoomableImage({ src, alt, id, title }: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // State drives rendering; refs mirror state for use inside non-React event listeners
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const maxX = (el.offsetWidth * (s - 1)) / 2;
    const maxY = (el.offsetHeight * (s - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const reset = useCallback(() => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;
      const prevScale = scaleRef.current;
      const nextScale = Math.min(10, Math.max(1, prevScale * (1 - e.deltaY * 0.001)));
      const factor = nextScale / prevScale;
      const rawX = cursorX - factor * (cursorX - offsetRef.current.x);
      const rawY = cursorY - factor * (cursorY - offsetRef.current.y);
      const clamped = clampOffset(rawX, rawY, nextScale);
      scaleRef.current = nextScale;
      offsetRef.current = clamped;
      setScale(nextScale);
      setOffset(clamped);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampOffset]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current === 1) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const clamped = clampOffset(
        dragRef.current.ox + dx,
        dragRef.current.oy + dy,
        scaleRef.current
      );
      offsetRef.current = clamped;
      setOffset(clamped);
    },
    [clampOffset]
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      <div className="relative overflow-hidden rounded-xl border border-zinc-700 transition-colors hover:border-zinc-500">
        {scale > 1 && (
          <button
            type="button"
            onClick={reset}
            className="absolute right-2 top-2 z-10 rounded-md bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Reset
          </button>
        )}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden"
          style={{
            height: 'calc(100vh - 120px)',
            cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
            unoptimized
            loading="eager"
            draggable={false}
          />
        </div>
      </div>
    </section>
  );
}

export interface GalleryItem {
  src: string;
  id: string;
  title: string;
}

interface Props {
  items: GalleryItem[];
}

export default function UsefulMapsGallery({ items }: Props) {
  if (items.length === 0) {
    return <p className="py-20 text-center text-zinc-500">No useful maps available.</p>;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {items.map((item) => (
        <ZoomableImage key={item.src} {...item} alt={item.title} />
      ))}
    </div>
  );
}
