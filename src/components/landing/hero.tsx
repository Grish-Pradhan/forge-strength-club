'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';

/**
 * Full-screen hero — high-energy image backdrop, staggered entrance
 * animations, and the primary "Join Now" CTA.
 */
export function Hero({
  headline,
  subhead,
  cta,
  imageUrl,
}: {
  headline: string;
  subhead: string;
  cta: string;
  imageUrl?: string;
}) {
  const backdrop =
    imageUrl ||
    'https://medtxqmxzuapjflzpqgx.supabase.co/storage/v1/object/public/site-assets/hero-backdrop.jpg';

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      {/* Backdrop image (LCP) with dark ember-tinted overlay */}
      <div className="absolute inset-0">
        <Image
          src={backdrop}
          alt="Athlete training under barbell loading at Forge Strength Club"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Layered overlays for contrast + brand energy */}
        <div className="absolute inset-0 bg-ink-800/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 via-ink-800/40 to-ink-800/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ember/25 via-transparent to-transparent" />
      </div>

      {/* Blueprint grid accent */}
      <div className="grid-texture absolute inset-0" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-4 py-1.5 backdrop-blur-sm"
        >
          <Zap className="h-4 w-4 text-ember" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-ember">
            Est. 2019 · Strength & Conditioning
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="font-display max-w-4xl text-6xl leading-[0.95] text-bone sm:text-7xl lg:text-8xl"
        >
          {headline.split(' ').map((word, i) => (
            <span key={i}>
              {i === headline.split(' ').length - 1 ? (
                <span className="text-ember">{word} </span>
              ) : (
                <span>{word} </span>
              )}
            </span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/70"
        >
          {subhead}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/register"
            className="btn-ember animate-pulse-glow group inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-ink-800 sm:text-lg"
          >
            {cta}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/#classes"
            className="btn-outline inline-flex items-center justify-center rounded-xl px-8 py-4 text-base font-semibold text-bone"
          >
            View Class Schedule
          </Link>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-4"
        >
          {[
            { value: '1,200+', label: 'Active members' },
            { value: '40+', label: 'Weekly classes' },
            { value: '12', label: 'Certified coaches' },
            { value: '24/7', label: 'Elite access' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-3xl text-bone">{stat.value}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="h-10 w-6 rounded-full border-2 border-white/25 p-1"
        >
          <div className="h-2 w-full rounded-full bg-ember" />
        </motion.div>
      </motion.div>
    </section>
  );
}
