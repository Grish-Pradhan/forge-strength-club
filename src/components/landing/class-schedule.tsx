'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, User, Users } from 'lucide-react';
import type { ClassWithCount } from '@/lib/types';
import { cn, formatFullDateTime } from '@/lib/utils';
import { Reveal } from './reveal';

/**
 * Public, filterable class schedule.
 * Filter chips by category; classes sorted chronologically; spots-left
 * badges turn ember when a class is nearly/full.
 */
export function ClassSchedule({ classes }: { classes: ClassWithCount[] }) {
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(classes.map((c) => c.category))).sort()],
    [classes],
  );
  const [active, setActive] = useState('All');

  const filtered = useMemo(() => {
    const list = active === 'All' ? classes : classes.filter((c) => c.category === active);
    return [...list].sort(
      (a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime(),
    );
  }, [classes, active]);

  return (
    <section id="classes" className="relative bg-ink-800 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="mb-3 inline-block text-xs font-bold uppercase tracking-[0.25em] text-ember">
                Schedule
              </span>
              <h2 className="font-display text-5xl text-bone sm:text-6xl">
                UPCOMING <span className="text-ember">CLASSES</span>
              </h2>
              <p className="mt-4 text-lg text-white/60">
                Book a spot from the member app with a single tap.
              </p>
            </div>

            {/* Category filter chips */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter classes by category">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active === cat}
                  onClick={() => setActive(cat)}
                  className={cn(
                    'chip rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/60 hover:border-white/35',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Class grid */}
        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center text-white/50">
            No classes scheduled in this category yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((c, i) => {
              const spotsLeft = Math.max(c.capacity - c.booked_count, 0);
              const isFull = spotsLeft === 0;
              const isAlmostFull = !isFull && spotsLeft <= Math.ceil(c.capacity * 0.2);
              return (
                <motion.article
                  key={c.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.3) }}
                  className="glass-card card-lift group flex flex-col overflow-hidden"
                >
                  {/* Cover image */}
                  <div className="relative h-40 overflow-hidden">
                    {c.image_url ? (
                      <Image
                        src={c.image_url}
                        alt={c.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grain-bg h-full w-full" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-800 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-ink-800/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-bone backdrop-blur-sm">
                      {c.category}
                    </span>
                    <span
                      className={cn(
                        'absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm',
                        isFull
                          ? 'bg-red-500/90 text-white'
                          : isAlmostFull
                            ? 'bg-ember/90 text-ink-800'
                            : 'bg-emerald-500/85 text-ink-800',
                      )}
                    >
                      {isFull ? 'Full' : `${spotsLeft} spots left`}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-2xl tracking-wide text-bone">{c.title}</h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-white/55">
                      {c.description}
                    </p>
                    <div className="mt-4 space-y-1.5 text-xs text-white/60">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-ember" />
                        {formatFullDateTime(c.schedule_time)}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-ember" />
                        Coach {c.trainer_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-ember" />
                        {c.booked_count}/{c.capacity} booked
                      </div>
                    </div>
                    <Link
                      href="/dashboard/bookings"
                      className="btn-outline mt-5 inline-flex items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-bone"
                    >
                      {isFull ? 'Join waitlist' : 'Book this class'}
                      <Clock className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
