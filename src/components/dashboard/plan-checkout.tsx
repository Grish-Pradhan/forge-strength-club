'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CreditCard,
  Loader2,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { cn, formatPrice } from '@/lib/utils';
import type { PaymentProvider, Plan } from '@/lib/types';

/**
 * Plan Checkout — pay for a membership plan online with eSewa or Khalti.
 *
 * Flow:
 *   1. Pick a plan (radio cards) + payment provider.
 *   2. POST /api/payments/checkout — the server verifies the session, reads
 *      the authoritative price from the DB and creates a pending payment.
 *   3. eSewa: the signed form returned by the server is auto-submitted.
 *      Khalti: the browser is redirected to the payment URL.
 *
 * Fulfillment (membership activation) happens in the gateway callback after
 * signature + status verification — never from this component.
 */

const supabase = () => createClient();

/** Submit a hidden form to the eSewa gateway (auto-POST, like eSewa's docs). */
function submitEsewaForm(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

const PROVIDERS: {
  id: PaymentProvider;
  name: string;
  description: string;
  icon: typeof Wallet;
}[] = [
  {
    id: 'esewa',
    name: 'eSewa',
    description: 'Nepal\u2019s most-used digital wallet',
    icon: Wallet,
  },
  {
    id: 'khalti',
    name: 'Khalti',
    description: 'Pay instantly from wallet, mobile banking or connected banks',
    icon: Smartphone,
  },
];

export function PlanCheckout() {
  const { profile } = useAuth();

  const plansQuery = useQuery({
    queryKey: ['plans', 'checkout'],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase()
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as Plan[]) ?? [];
    },
  });

  const plans = useMemo(
    () => (plansQuery.data ?? []).sort((a, b) => a.sort_order - b.sort_order),
    [plansQuery.data],
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>('esewa');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlanId = profile?.plan_id ?? null;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const expiresAt = profile?.membership_expires_at
    ? new Date(profile.membership_expires_at)
    : null;
  const expiryValid = expiresAt !== null && expiresAt > new Date();

  async function handleCheckout() {
    if (!selectedPlan || starting) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: selectedPlan.id, provider }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        provider?: PaymentProvider;
        type?: 'form' | 'redirect';
        action?: string;
        fields?: Record<string, string>;
        url?: string;
      } | null;

      if (!res.ok || !data || data.error) {
        setError(data?.error ?? 'Could not start the payment. Please try again.');
        setStarting(false);
        return;
      }

      if (data.type === 'form' && data.action && data.fields) {
        submitEsewaForm(data.action, data.fields);
        // The browser navigates away — keep the spinner up.
        return;
      }
      if (data.type === 'redirect' && data.url) {
        window.location.href = data.url;
        return;
      }

      setError('Unexpected payment response. Please try again.');
      setStarting(false);
    } catch {
      setError('Network error — please check your connection and try again.');
      setStarting(false);
    }
  }

  if (plansQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading plans…</span>
      </div>
    );
  }

  if (plansQuery.isError) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
        Could not load membership plans. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan + expiry summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">Current plan</div>
          <div className="text-sm font-bold text-bone">
            {activePlanId ? (plans.find((p) => p.id === activePlanId)?.name ?? 'Custom plan') : 'No plan'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-white/50">
            {expiryValid ? 'Renews / expires' : 'Status'}
          </div>
          <div className="flex items-center gap-1.5 text-sm font-bold capitalize text-bone">
            {expiryValid ? (
              <>
                <BadgeCheck className="h-4 w-4 text-emerald-400" />
                {expiresAt!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </>
            ) : (
              profile?.membership_status ?? 'inactive'
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-white/40">
          <CreditCard className="h-4 w-4" />
          Payments processed securely via eSewa / Khalti (NPR)
        </div>
      </div>

      {/* Plan picker */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlanId(plan.id)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className={cn(
              'relative flex flex-col rounded-xl border p-4 text-left transition-all',
              selectedPlanId === plan.id
                ? 'border-ember/70 bg-ember/10 shadow-ember'
                : 'border-white/10 bg-white/5 hover:border-white/25',
            )}
            aria-pressed={selectedPlanId === plan.id}
          >
            {activePlanId === plan.id && (
              <span className="absolute top-3 right-3 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Current
              </span>
            )}
            <div className="font-display text-xl tracking-wide text-bone">{plan.name}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-2xl text-ember">{formatPrice(plan.price)}</span>
              <span className="text-xs text-white/40">/{plan.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
            <ul className="mt-2.5 space-y-1">
              {(Array.isArray(plan.features) ? (plan.features as string[]) : []).slice(0, 3).map((f) => (
                <li key={f} className="flex items-start gap-1.5 text-[11px] text-white/55">
                  <Check className="mt-0.5 h-3 w-3 flex-none text-ember" strokeWidth={3} />
                  <span className="line-clamp-1">{f}</span>
                </li>
              ))}
            </ul>
          </motion.button>
        ))}
      </div>

      {/* Provider picker */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={cn(
              'flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all',
              provider === p.id
                ? 'border-ember/70 bg-ember/10'
                : 'border-white/10 bg-white/5 hover:border-white/25',
            )}
            aria-pressed={provider === p.id}
          >
            <span
              className={cn(
                'flex h-10 w-10 flex-none items-center justify-center rounded-lg transition-colors',
                provider === p.id ? 'bg-ember/20' : 'bg-white/10',
              )}
            >
              <p.icon className={cn('h-5 w-5', provider === p.id ? 'text-ember' : 'text-white/60')} />
            </span>
            <div>
              <div className="text-sm font-bold text-bone">{p.name}</div>
              <div className="text-xs text-white/50">{p.description}</div>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          {error}
        </div>
      )}

      {/* Checkout button */}
      <button
        type="button"
        disabled={!selectedPlan || starting}
        onClick={() => void handleCheckout()}
        className="btn-ember inline-flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-ink-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-10"
      >
        {starting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to {provider === 'esewa' ? 'eSewa' : 'Khalti'}…
          </>
        ) : selectedPlan ? (
          <>
            Pay {formatPrice(selectedPlan.price)} with {provider === 'esewa' ? 'eSewa' : 'Khalti'}
          </>
        ) : (
          'Select a plan to continue'
        )}
      </button>

      <p className="text-xs leading-relaxed text-white/40">
        Your membership activates automatically once the gateway confirms the payment —
        usually within seconds of completing it. Renewing before expiry extends your
        days from the current end date, so you never lose paid time.
      </p>
    </div>
  );
}
