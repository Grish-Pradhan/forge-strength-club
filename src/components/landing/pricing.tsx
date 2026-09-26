'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import type { Plan } from '@/lib/types';
import { cn, formatPrice } from '@/lib/utils';
import { Reveal } from './reveal';

/**
 * Pricing — cards with a Monthly/Annual billing toggle.
 * Annual shows an effective-discount badge. The middle ("Forge") plan is
 * highlighted as the most popular tier.
 */
export function Pricing({ plans, title, subhead }: { plans: Plan[]; title: string; subhead: string }) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

  const visible = useMemo(
    () =>
      plans
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [plans],
  );

  return (
    <section id="pricing" className="grain-bg relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block text-xs font-bold uppercase tracking-[0.25em] text-ember">
              Pricing
            </span>
            <h2 className="font-display text-5xl text-bone sm:text-6xl">{title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">{subhead}</p>

            {/* Billing cycle toggle */}
            <div
              className="mx-auto mt-8 inline-flex rounded-full border border-white/15 bg-ink-900/80 p-1 backdrop-blur-sm"
              role="group"
              aria-label="Billing cycle"
            >
              {(['monthly', 'annual'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cycle === c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    'rounded-full px-6 py-2.5 text-sm font-bold capitalize transition-all duration-300',
                    cycle === c
                      ? 'bg-ember text-ink-800 shadow-ember'
                      : 'text-white/60 hover:text-bone',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {visible.map((plan, i) => {
            const featured = i === 1;
            // Honest pricing math: always show a per-cycle equivalent.
            //  - monthly view: annual plans show price/12 ("billed annually")
            //  - annual view:  monthly plans show price*12 ("annual equivalent")
            const isAnnualPlan = plan.billing_cycle === 'annual';
            const price = cycle === 'monthly' ? (isAnnualPlan ? plan.price / 12 : plan.price) : isAnnualPlan ? plan.price : plan.price * 12;
            const converted = cycle !== plan.billing_cycle;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                className={cn(
                  'glass-card card-lift relative flex flex-col p-8',
                  featured && 'border-ember/60 shadow-ember-lg md:-translate-y-3 md:scale-[1.03]',
                )}
              >
                {featured && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ember px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-ink-800 shadow-ember">
                    <Sparkles className="h-3.5 w-3.5" />
                    Most popular
                  </span>
                )}

                <h3 className="font-display text-3xl tracking-wide text-bone">{plan.name}</h3>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-6xl text-ember">{formatPrice(price)}</span>
                  <span className="text-sm font-medium text-white/50">
                    /{cycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {converted && (
                  <p className="mt-1 text-xs text-white/40">
                    {isAnnualPlan
                      ? 'Billed annually — shown as monthly equivalent'
                      : 'Annual equivalent — billed as one payment'}
                  </p>
                )}

                <ul className="mt-8 flex-1 space-y-3.5">
                  {(Array.isArray(plan.features) ? (plan.features as string[]) : []).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ember/15">
                        <Check className="h-3 w-3 text-ember" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    'mt-8 inline-flex items-center justify-center rounded-xl py-3.5 text-sm font-bold transition-all',
                    featured ? 'btn-ember text-ink-800' : 'btn-outline text-bone',
                  )}
                >
                  Start with {plan.name}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
