'use client';

import Image from 'next/image';

interface Props {
  items: { id: string; title: string; src: string }[];
  scrollContainerId: string;
}

export default function UsefulMapsSidebar({ items, scrollContainerId }: Props) {
  const scrollTo = (id: string) => {
    const container = document.getElementById(scrollContainerId);
    const target = document.getElementById(id);
    if (!container || !target) return;
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: top - 8, behavior: 'smooth' });
  };

  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-zinc-800 bg-[#181c22] px-2 py-3">
      {items.map(({ id, title, src }) => (
        <button
          key={id}
          type="button"
          onClick={() => scrollTo(id)}
          className="group flex flex-col gap-1 rounded-md p-1.5 text-left transition-colors hover:bg-zinc-800"
        >
          <div className="aspect-[5/2] overflow-hidden rounded border border-zinc-700/60 transition-colors group-hover:border-blue-600">
            <Image
              src={src}
              alt={title}
              width={200}
              height={80}
              className="h-auto w-full object-cover"
              style={{ height: 'auto' }}
              unoptimized
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200">
            {title}
          </span>
        </button>
      ))}
    </nav>
  );
}
