import Link from 'next/link';
import { CheckCircle2, Dumbbell } from 'lucide-react';

/**
 * Payment success — the gateway callback redirects here after the payment
 * has been verified and the membership activated.
 */
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <div className="grain-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-10 text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </span>
        <h1 className="font-display text-4xl tracking-wide text-bone">PAYMENT COMPLETE</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Your membership is now <strong className="text-emerald-400">active</strong> — class
          bookings are unlocked. Time to forge.
        </p>
        {ref && (
          <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-xs text-white/50">
            Transaction ref: {ref}
          </p>
        )}
        <Link
          href="/dashboard/bookings"
          className="btn-ember mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-ink-800"
        >
          <Dumbbell className="h-4 w-4" />
          Book your first class
        </Link>
        <Link
          href="/dashboard"
          className="mt-3 block text-sm text-white/50 transition-colors hover:text-bone"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
