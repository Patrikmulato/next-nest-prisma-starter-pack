'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const TABS = [
  { label: 'Dashboard', href: '/dashboard', isAdminOnly: true },
  { label: 'World Map', href: '/' },
  { label: 'US Plates', href: '/us-plates' },
  { label: 'Useful Maps', href: '/useful-maps' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { status, role, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-[#181c22] px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-white">GeoGuessr Helper</span>
        {status === 'authenticated' && role && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title={`Signed in as ${role}`}
              aria-label={`Signed in as ${role}`}
              className="flex items-center justify-center rounded-full p-0.5 transition-transform hover:scale-110"
            >
              <span className="block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-500/30" />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-6 z-50 w-44 rounded-md border border-zinc-700 bg-[#20262e] p-2 shadow-lg">
                <p className="px-2 py-1 text-xs text-zinc-400">
                  Role: <span className="font-semibold text-zinc-200">{role}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="mt-1 w-full rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <nav className="flex gap-1">
        {TABS.map(({ label, href, isAdminOnly }) => {
          const isActive = pathname === href;
          if (isAdminOnly && !isAdmin) {
            return null;
          }
          return isActive ? (
            <span
              key={href}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              {label}
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
