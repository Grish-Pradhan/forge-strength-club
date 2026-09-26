'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, LayoutDashboard, CalendarDays, UserCircle, FileText } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { BrandMark } from '@/components/logo';
import { cn, initials } from '@/lib/utils';

/**
 * Shared dashboard shell used by both the Member Dashboard and the Admin
 * Panel. Sidebar adapts to the viewer's role.
 */

const MEMBER_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: UserCircle },
  { href: '/admin/classes', label: 'Classes', icon: CalendarDays },
  { href: '/admin/content', label: 'Site Content', icon: FileText },
];

export function DashboardShell({
  children,
  area,
  title,
}: {
  children: React.ReactNode;
  area: 'member' | 'admin';
  title: string;
}) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const [avatarError, setAvatarError] = useState(false);
  const nav = area === 'admin' ? ADMIN_NAV : MEMBER_NAV;

  return (
    <div className="grain-bg min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-800/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center">
              <BrandMark markClassName="h-8 w-auto" />
            </Link>
            <span className="hidden text-sm font-semibold text-white/40 md:block">/ {title}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="hidden items-center gap-3 sm:flex">
              {profile?.avatar_url && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? 'Avatar'}
                  onError={() => setAvatarError(true)}
                  className="h-9 w-9 rounded-full border border-white/15 object-cover"
                />
              ) : (
                <span className="avatar h-9 w-9 rounded-full bg-gold text-sm">
                  {initials(profile?.full_name)}
                </span>
              )}
              <div className="leading-tight">
                <div className="text-sm font-semibold text-bone">{profile?.full_name ?? '…'}</div>
                <div className="text-xs capitalize text-white/40">{profile?.role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-white/70 transition-all hover:border-red-500/50 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Sidebar nav */}
        <aside className="hidden w-56 flex-none md:block">
          <nav className="sticky top-24 space-y-1" aria-label={`${area} navigation`}>
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
                    active
                      ? 'bg-ember/15 text-ember shadow-[inset_0_0_0_1px_rgba(255,90,31,0.3)]'
                      : 'text-white/60 hover:bg-white/5 hover:text-bone',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {area === 'admin' && (
              <Link
                href="/dashboard"
                className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/50 transition-all hover:border-white/25 hover:text-bone"
              >
                <LayoutDashboard className="h-4 w-4" />
                Member view
              </Link>
            )}
          </nav>
        </aside>

        {/* Mobile tab nav */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-800/95 backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-7xl" aria-label={`${area} navigation`}>
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
                    active ? 'text-ember' : 'text-white/50',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-24 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
