'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Dumbbell,
  Loader2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  useBookableClasses,
  useBookClass,
  useCancelBooking,
  useMyBookings,
} from '@/lib/hooks/use-member-data';
import { cn, errorMessage, formatFullDateTime } from '@/lib/utils';
import type { GymClass } from '@/lib/types';

const CATEGORIES = ['All', 'Strength', 'HIIT', 'CrossFit', 'Boxing', 'Yoga & Mobility'];

/**
 * Schedule & Bookings — book a spot with a single click, manage upcoming
 * bookings. All data flows through React Query hooks backed by Supabase.
 */
export function BookingsManager() {
  const { profile } = useAuth();
  const classesQuery = useBookableClasses();
  const bookingsQuery = useMyBookings();
  const bookClass = useBookClass();
  const cancelBooking = useCancelBooking();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const isActive = profile?.membership_status === 'active';

  const myBookedClassIds = useMemo(
    () => new Set((bookingsQuery.data ?? []).map((b) => b.class_id)),
    [bookingsQuery.data],
  );

  const filteredClasses = useMemo(() => {
    const list = classesQuery.data ?? [];
    if (selectedCategory === 'All') return list;
    return list.filter((c) => c.category === selectedCategory);
  }, [classesQuery.data, selectedCategory]);

  const routineDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const bookings = (bookingsQuery.data ?? []).filter((booking) => {
        const gymClass = booking.class as GymClass | null;
        return gymClass && dateKey(new Date(gymClass.schedule_time)) === dateKey(date);
      });
      return { date, bookings };
    });
  }, [bookingsQuery.data]);

  return (
    <div className="space-y-10">
      {/* ---------- Inactive membership notice ---------- */}
      {!isActive && (
        <div className="glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start sm:items-center gap-3.5">
            <Sparkles className="h-5 w-5 text-amber-400 mt-0.5 sm:mt-0 flex-none" />
            <div>
              <h4 className="font-semibold text-bone text-sm">Membership is inactive</h4>
              <p className="text-xs text-white/60 mt-0.5">
                To book workout sessions, select an active plan on your profile or contact staff.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/profile"
            className="btn-ember text-ink-800 text-xs font-bold px-4 py-2 rounded-lg self-start sm:self-auto whitespace-nowrap"
          >
            Go to Profile & Billing →
          </Link>
        </div>
      )}

      {/* ---------- Weekly routine chart ---------- */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl tracking-wide text-bone">MY 7-DAY ROUTINE</h2>
            <p className="mt-1 text-sm text-white/45">
              Your confirmed training week at a glance.
            </p>
          </div>
          <CalendarDays className="h-6 w-6 flex-none text-ember" />
        </div>

        <div className="glass-card overflow-x-auto p-4">
          <div className="grid min-w-[840px] grid-cols-7 gap-3" role="list" aria-label="Seven day training routine">
            {routineDays.map(({ date, bookings }) => (
              <div key={date.toISOString()} className="min-h-48 rounded-xl border border-white/8 bg-ink-900/55 p-3" role="listitem">
                <div className="border-b border-white/8 pb-2 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ember">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="font-display text-2xl text-bone">{date.getDate()}</div>
                </div>
                <div className="mt-3 space-y-2">
                  {bookings.length === 0 ? (
                    <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-[11px] text-white/25">
                      <Dumbbell className="h-4 w-4" />
                      Rest / open day
                    </div>
                  ) : (
                    bookings.map((booking) => {
                      const gymClass = booking.class as GymClass;
                      return (
                        <div key={booking.id} className="rounded-lg border border-ember/20 bg-ember/10 p-2.5">
                          <div className="line-clamp-2 text-xs font-semibold text-bone">
                            {gymClass.title}
                          </div>
                          <div className="mt-1 text-[10px] text-ember">
                            {new Date(gymClass.schedule_time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-white/35">
                            {gymClass.trainer_name || 'Coach TBA'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- My upcoming bookings ---------- */}
      <section>
        <h2 className="font-display mb-4 text-3xl tracking-wide text-bone">MY BOOKINGS</h2>

        {bookingsQuery.isLoading ? (
          <LoadingRow />
        ) : bookingsQuery.isError ? (
          <ErrorRow message={errorMessage(bookingsQuery.error)} />
        ) : (bookingsQuery.data ?? []).length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
            <CalendarDays className="h-8 w-8 text-white/30" />
            <p className="text-sm text-white/50">
              No upcoming bookings. Pick a class below and grab a spot.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(bookingsQuery.data ?? []).map((b, i) => {
              const cls = b.class as GymClass | null;
              return (
                <motion.li
                  key={b.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="glass-card flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-none text-emerald-400" />
                      <h3 className="truncate font-semibold text-bone">
                        {cls?.title ?? 'Class'}
                      </h3>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-white/55">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-ember" />
                        {cls ? formatFullDateTime(cls.schedule_time) : '—'}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-ember" />
                        Coach {cls?.trainer_name ?? '—'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={cancelBooking.isPending}
                    onClick={() => void cancelBooking.mutateAsync(b.id).catch(() => {})}
                    className="flex-none rounded-lg border border-white/10 p-2.5 text-white/50 transition-all hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
                    aria-label={`Cancel booking for ${cls?.title ?? 'class'}`}
                    title="Cancel booking"
                  >
                    {cancelBooking.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Bookable classes ---------- */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-display text-3xl tracking-wide text-bone">AVAILABLE CLASSES</h2>
          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  selectedCategory === cat
                    ? 'bg-ember text-ink-900 font-bold shadow-md'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-bone border border-white/10',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {bookClass.isError && <ErrorRow message={errorMessage(bookClass.error)} />}
        {cancelBooking.isError && <ErrorRow message={errorMessage(cancelBooking.error)} />}

        {classesQuery.isLoading ? (
          <LoadingRow />
        ) : classesQuery.isError ? (
          <ErrorRow message={errorMessage(classesQuery.error)} />
        ) : filteredClasses.length === 0 ? (
          <div className="glass-card p-12 text-center text-white/40 text-sm">
            No classes found for category &ldquo;{selectedCategory}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((c, i) => {
              const spotsLeft = Math.max(c.capacity - c.booked_count, 0);
              const isFull = spotsLeft === 0;
              const alreadyBooked = myBookedClassIds.has(c.id);
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.25) }}
                  className="glass-card card-lift group flex flex-col overflow-hidden"
                >
                  {/* Card cover image */}
                  {c.image_url ? (
                    <div className="relative h-44 w-full overflow-hidden bg-ink-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image_url}
                        alt={c.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
                      <span className="absolute top-3 left-3 rounded-full bg-ink-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ember backdrop-blur-md border border-white/10">
                        {c.category}
                      </span>
                      <span
                        className={cn(
                          'absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md',
                          isFull
                            ? 'bg-red-500/90 text-white'
                            : alreadyBooked
                              ? 'bg-emerald-500/90 text-ink-900 font-extrabold'
                              : 'bg-ink-900/80 text-white/90 border border-white/15',
                        )}
                      >
                        {alreadyBooked ? 'Booked' : isFull ? 'Full' : `${spotsLeft} spots left`}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {!c.image_url && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ember">
                            {c.category}
                          </span>
                        )}
                        <h3 className="font-display mt-0.5 text-2xl tracking-wide text-bone">
                          {c.title}
                        </h3>
                      </div>
                      {!c.image_url && (
                        <span
                          className={cn(
                            'flex-none rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                            isFull
                              ? 'bg-red-500/90 text-white'
                              : alreadyBooked
                                ? 'bg-emerald-500/85 text-ink-800'
                                : 'bg-white/10 text-white/70',
                          )}
                        >
                          {alreadyBooked ? 'Booked' : isFull ? 'Full' : `${spotsLeft} left`}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-white/55">
                      {c.description}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-white/60">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-ember" />
                        {formatFullDateTime(c.schedule_time)}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-ember" />
                        Coach {c.trainer_name}
                      </div>
                    </div>

                    {/* One-click booking */}
                    <button
                      type="button"
                      disabled={isFull || alreadyBooked || bookClass.isPending}
                      onClick={() => void bookClass.mutateAsync(c.id)}
                      className={cn(
                        'mt-5 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all',
                        alreadyBooked
                          ? 'cursor-default border border-emerald-500/40 text-emerald-400 bg-emerald-500/5'
                          : isFull
                            ? 'cursor-not-allowed border border-white/10 text-white/30'
                            : 'btn-ember text-ink-800',
                      )}
                    >
                    {bookClass.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Booking…
                      </>
                    ) : alreadyBooked ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Spot confirmed
                      </>
                    ) : isFull ? (
                      'Class full'
                    ) : (
                      <>
                        <CalendarPlus className="h-4 w-4" />
                        Book a spot
                      </>
                    )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-white/40">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

function ErrorRow({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
      {message}
      <Link href="/dashboard/bookings" className="ml-auto flex-none underline">
        Retry
      </Link>
    </div>
  );
}

