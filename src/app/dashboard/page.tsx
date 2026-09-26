import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CircleUser,
  Flame,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatFullDateTime, initials } from '@/lib/utils';
import { Reveal } from '@/components/landing/reveal';
import type { Booking, Profile } from '@/lib/types';

/**
 * Member Dashboard — Overview.
 * Server Component: reads the member's profile + next booked class with the
 * request-scoped Supabase client (RLS enforced server-side).
 */
export default async function MemberOverviewPage() {
  const supabase = await createClient();

  // Middleware already validated the JWT and refreshed the session in THIS
  // request, forwarding the user id via an internal header — reading it here
  // avoids a second Supabase auth roundtrip (spoof-proof: middleware always
  // overwrites the header with the validated value).
  const requestHeaders = await headers();
  const userId = requestHeaders.get('x-forge-user-id');
  if (!userId) redirect('/login?next=/dashboard');

  // Profile + next confirmed booking (with class) — parallel.
  const [{ data: profile }, { data: nextBookings }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('bookings')
      .select('*, class:classes(*)')
      .eq('user_id', userId)
      .eq('booking_status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(4),
  ]);

  const me = profile as Profile | null;
  const upcoming = (nextBookings as Booking[] | null)?.filter(
    (b) => b.class && new Date((b.class as { schedule_time: string }).schedule_time) > new Date(),
  );

  const firstName = me?.full_name?.split(' ')[0] ?? 'athlete';
  const status = me?.membership_status ?? 'inactive';
  const isActive = status === 'active';

  return (
    <div className="space-y-8">
      {/* ---------- Greeting + status ---------- */}
      <Reveal>
        <div className="glass-card relative overflow-hidden p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-ember/10 via-transparent to-transparent" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              {me?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.avatar_url}
                  alt={me.full_name ?? 'Avatar'}
                  className="h-16 w-16 rounded-2xl border border-white/15 object-cover"
                />
              ) : (
                <span className="avatar h-16 w-16 rounded-2xl bg-gold text-2xl">
                  {initials(me?.full_name)}
                </span>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember">
                  Welcome back
                </p>
                <h1 className="font-display mt-1 text-4xl tracking-wide text-bone sm:text-5xl">
                  {firstName.toUpperCase()}
                </h1>
              </div>
            </div>

            {/* Membership status */}
            <div
              className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 ${
                isActive
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : status === 'suspended'
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-white/15 bg-white/5'
              }`}
            >
              <Flame
                className={`h-5 w-5 ${
                  isActive ? 'text-emerald-400' : status === 'suspended' ? 'text-red-400' : 'text-white/50'
                }`}
              />
              <div>
                <div className="text-xs uppercase tracking-wider text-white/50">Membership</div>
                <div className="text-sm font-bold capitalize text-bone">{status}</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------- Quick actions ---------- */}
      <Reveal delay={0.1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              href: '/dashboard/bookings',
              icon: CalendarPlus,
              title: 'Book a Class',
              description: 'Grab a spot in an upcoming session',
            },
            {
              href: '/dashboard/bookings',
              icon: CalendarDays,
              title: 'My Bookings',
              description: 'Manage your upcoming schedule',
            },
            {
              href: '/dashboard/profile',
              icon: CircleUser,
              title: 'Profile & Billing',
              description: 'Update your info and plan',
            },
          ].map((a) => (
            <Link
              key={a.title}
              href={a.href}
              className="glass-card card-lift group flex items-center gap-4 p-5"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-ember/15 transition-colors group-hover:bg-ember/25">
                <a.icon className="h-5 w-5 text-ember" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-bone">
                  {a.title}
                  <ArrowRight className="h-3.5 w-3.5 text-ember opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-xs text-white/50">{a.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* ---------- Upcoming booked classes ---------- */}
      <Reveal delay={0.15}>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-3xl tracking-wide text-bone">
              UPCOMING <span className="text-ember">SESSIONS</span>
            </h2>
            <Link
              href="/dashboard/bookings"
              className="text-sm font-semibold text-ember hover:underline"
            >
              Book more →
            </Link>
          </div>

          {upcoming && upcoming.length > 0 ? (
            <ul className="space-y-3">
              {upcoming.map((b) => {
                const cls = b.class!;
                return (
                  <li key={b.id} className="glass-card flex items-center gap-4 p-5">
                    <div className="flex h-12 w-14 flex-none flex-col items-center justify-center rounded-xl bg-ember/15">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ember">
                        {new Date(cls.schedule_time).toLocaleDateString('en-US', {
                          weekday: 'short',
                        })}
                      </span>
                      <span className="font-display text-lg leading-none text-bone">
                        {new Date(cls.schedule_time)
                          .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                          .replace(/\s?[AP]M/, '')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-bone">{cls.title}</h3>
                      <p className="mt-0.5 text-xs text-white/50">
                        {formatFullDateTime(cls.schedule_time)} · Coach {cls.trainer_name}
                      </p>
                    </div>
                    <span className="hidden rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 sm:block">
                      Confirmed
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
              <UserRound className="h-8 w-8 text-white/30" />
              <p className="text-sm text-white/50">
                Nothing booked yet — your next PR is one click away.
              </p>
              <Link
                href="/dashboard/bookings"
                className="btn-ember mt-2 rounded-lg px-6 py-2.5 text-sm font-bold text-ink-800"
              >
                Book a class
              </Link>
            </div>
          )}

          {!isActive && (
            <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
              Heads up: your membership is <strong>{status}</strong>, so new bookings are
              locked. Visit your profile or the front desk to activate it.
            </p>
          )}
        </section>
      </Reveal>
    </div>
  );
}
