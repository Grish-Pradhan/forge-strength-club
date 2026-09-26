'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { BrandMark } from '@/components/logo';
import { cn } from '@/lib/utils';

/**
 * Site navigation. Adapts to auth state:
 *  - anonymous  -> "Join Now" CTA
 *  - member     -> Dashboard link
 *  - admin      -> Admin Panel link (+ Dashboard)
 */
const NAV_LINKS = [
  { href: '/#classes', label: 'Classes' },
  { href: '/#amenities', label: 'Amenities' },
  { href: '/#pricing', label: 'Pricing' },
];

export function Navbar() {
  const { session, role, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink-800/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link text-sm font-medium text-white/70 transition-colors hover:text-bone"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-3 md:flex">
          {!loading && session ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-bone"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </>
          ) : (
            !loading && (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-bone"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="btn-ember rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800"
                >
                  Join Now
                </Link>
              </>
            )
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/5 md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile dropdown */}
      <div
        className={cn(
          'overflow-hidden border-t border-white/10 transition-[max-height] duration-300 md:hidden',
          open ? 'max-h-96' : 'max-h-0 border-t-0',
        )}
      >
        <div className="flex flex-col gap-1 bg-ink-800/95 px-4 py-4 backdrop-blur-xl">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            {!loading && session ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-center text-sm font-semibold text-bone"
                >
                  Dashboard
                </Link>
                {role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-gold/40 px-4 py-2.5 text-center text-sm font-semibold text-gold"
                  >
                    Admin Panel
                  </Link>
                )}
              </>
            ) : (
              !loading && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-bone"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="btn-ember rounded-lg px-4 py-2.5 text-center text-sm font-bold text-ink-800"
                  >
                    Join Now
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
