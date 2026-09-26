import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';

const REASONS: Record<string, string> = {
  empty_response: 'The gateway returned an empty response.',
  malformed_response: 'The gateway response could not be verified.',
  invalid_signature: 'The payment signature failed verification.',
  payment_not_found: 'No matching payment was found for this transaction.',
  amount_mismatch: 'The paid amount did not match the plan price.',
  unconfirmed: 'The gateway did not confirm this transaction.',
  canceled: 'The payment was cancelled before completion.',
  cancelled: 'The payment was cancelled before completion.',
  user_canceled: 'The payment was cancelled before completion.',
  gateway_unconfigured: 'The payment gateway is not configured on the server yet.',
  fulfillment: 'The payment was received but membership activation failed — contact the front desk with your transaction reference.',
  network_error: 'Could not reach the payment gateway.',
};

/**
 * Payment failed / cancelled — the gateway callback redirects here whenever
 * verification fails or the user cancels. No payment was taken.
 */
export default async function PaymentFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = (reason && REASONS[reason]) || 'The payment did not go through.';

  return (
    <div className="grain-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="glass-card w-full max-w-md p-10 text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </span>
        <h1 className="font-display text-4xl tracking-wide text-bone">PAYMENT FAILED</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{message}</p>
        <p className="mt-2 text-xs text-white/40">
          You have not been charged. Your membership status is unchanged.
        </p>
        <Link
          href="/dashboard/profile"
          className="btn-ember mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-ink-800"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
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
