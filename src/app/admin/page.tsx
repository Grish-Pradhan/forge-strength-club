import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  Activity,
  CalendarClock,
  DollarSign,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatFullDateTime, formatPrice } from '@/lib/utils';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';
import type { AdminUserRow, ClassWithCount, Plan } from '@/lib/types';

/**
 * Admin Panel — Overview / Analytics.
 * Server Component: high-level metrics (total & active members, MRR,
 * upcoming class attendance) computed from live Supabase data.
 */
export default async function AdminOverviewPage() {
  const supabase = await createClient();

  // Middleware already validated the JWT + admin role in THIS request and
  // forwarded the user id via an internal header — reading it here avoids a
  // second Supabase auth roundtrip (spoof-proof: middleware always
  // overwrites the header with the validated value).
  const requestHeaders = await headers();
  const userId = requestHeaders.get('x-forge-user-id');
  if (!userId) redirect('/login?next=/admin');

  // Parallel reads: profiles (+plan), plans, classes (+booked_count).
  const [{ data: profilesData }, { data: plansData }, { data: classesData }] =
    await Promise.all([
      supabase.from('profiles').select('*, plan:plans(name)').order('created_at', { ascending: false }),
      supabase.from('plans').select('*').order('sort_order'),
      supabase
        .from('classes_public')
        .select('*')
        .gte('schedule_time', new Date().toISOString())
        .order('schedule_time', { ascending: true })
        .limit(5),
    ]);

  const profiles = (profilesData ?? []) as AdminUserRow[];
  const plans = (plansData ?? []) as Plan[];
  const upcomingClasses = (classesData ?? []) as ClassWithCount[];

  const totalMembers = profiles.filter((p) => p.role === 'member').length;
  const activeMembers = profiles.filter(
    (p) => p.role === 'member' && p.membership_status === 'active',
  ).length;

  // MRR: for each active member with a plan, normalise the price to monthly.
  const planById = new Map(plans.map((p) => [p.id, p]));
  const mrr = profiles
    .filter((p) => p.membership_status === 'active' && p.plan_id)
    .reduce((sum, p) => {
      const plan = planById.get(p.plan_id!);
      if (!plan) return sum;
      return sum + (plan.billing_cycle === 'annual' ? plan.price / 12 : plan.price);
    }, 0);

  // Upcoming attendance: confirmed bookings across the next 5 classes.
  const upcomingAttendance = upcomingClasses.reduce((sum, c) => sum + c.booked_count, 0);

  const metrics = [
    {
      icon: Users,
      label: 'Total members',
      value: String(totalMembers),
      sub: `${profiles.length} accounts total`,
    },
    {
      icon: UserRoundCheck,
      label: 'Active members',
      value: String(activeMembers),
      sub:
        totalMembers > 0
          ? `${Math.round((activeMembers / totalMembers) * 100)}% of members`
          : '—',
    },
    {
      icon: DollarSign,
      label: 'Monthly revenue (MRR)',
      value: formatPrice(mrr),
      sub: 'From active memberships',
    },
    {
      icon: Activity,
      label: 'Upcoming attendance',
      value: String(upcomingAttendance),
      sub: 'Booked across next 5 classes',
    },
  ];

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-bone">COMMAND CENTER</h1>
          <p className="mt-1 text-sm text-white/50">
            High-level metrics across members, revenue and classes.
          </p>
        </div>
      </Reveal>

      {/* ---------- Metric cards ---------- */}
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <RevealItem key={m.label}>
            <div className="glass-card card-lift group p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember/15 transition-colors group-hover:bg-ember/25">
                  <m.icon className="h-5 w-5 text-ember" />
                </span>
                <TrendingUp className="h-4 w-4 text-white/20" />
              </div>
              <div className="font-display mt-4 text-5xl text-bone">{m.value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">
                {m.label}
              </div>
              <div className="mt-0.5 text-xs text-white/35">{m.sub}</div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ---------- Upcoming class attendance ---------- */}
        <Reveal delay={0.1}>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-wide text-bone">
                UPCOMING <span className="text-ember">CLASSES</span>
              </h2>
              <Link href="/admin/classes" className="text-sm font-semibold text-ember hover:underline">
                Manage →
              </Link>
            </div>
            <div className="glass-card divide-y divide-white/5">
              {upcomingClasses.length === 0 ? (
                <p className="p-8 text-center text-sm text-white/40">
                  No upcoming classes scheduled.
                </p>
              ) : (
                upcomingClasses.map((c) => {
                  const fillPct = Math.round((c.booked_count / c.capacity) * 100);
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-bone">{c.title}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                          <CalendarClock className="h-3 w-3 text-ember" />
                          {formatFullDateTime(c.schedule_time)} · {c.trainer_name}
                        </div>
                      </div>
                      <div className="flex-none text-right">
                        <div className="text-sm font-bold text-bone">
                          {c.booked_count}/{c.capacity}
                        </div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-ember transition-all"
                            style={{ width: `${Math.min(fillPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </Reveal>

        {/* ---------- Newest members ---------- */}
        <Reveal delay={0.15}>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-wide text-bone">
                NEWEST <span className="text-ember">MEMBERS</span>
              </h2>
              <Link href="/admin/users" className="text-sm font-semibold text-ember hover:underline">
                Manage →
              </Link>
            </div>
            <div className="glass-card divide-y divide-white/5">
              {profiles.length === 0 ? (
                <p className="p-8 text-center text-sm text-white/40">No users yet.</p>
              ) : (
                profiles.slice(0, 5).map((u) => (
                  <div key={u.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-bone">
                        {u.full_name || 'Unnamed'}
                      </div>
                      <div className="truncate text-xs text-white/45">{u.email}</div>
                    </div>
                    <span
                      className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        u.membership_status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : u.membership_status === 'suspended'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {u.membership_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </Reveal>
      </div>

      {/* ---------- Quick links ---------- */}
      <Reveal delay={0.2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { href: '/admin/users', label: 'User Management', desc: 'Add, edit, suspend, delete' },
            { href: '/admin/classes', label: 'Class Management', desc: 'CRUD classes & trainers' },
            { href: '/admin/content', label: 'Content Management', desc: 'Copy, plans, announcements' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="glass-card card-lift group p-5">
              <div className="flex items-center gap-1.5 font-semibold text-bone">
                {l.label}
                <TrendingUp className="h-3.5 w-3.5 text-ember opacity-0 transition-all group-hover:opacity-100" />
              </div>
              <p className="mt-0.5 text-xs text-white/50">{l.desc}</p>
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
