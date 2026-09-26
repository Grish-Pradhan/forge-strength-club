import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKhaltiConfig, lookupKhaltiPayment } from '@/lib/payments/khalti';
import { fulfillPayment, markPaymentFailed } from '@/lib/payments/service';
import type { BillingCycle } from '@/lib/types';

/**
 * GET /api/payments/khalti/callback — Khalti ePayment return_url.
 *
 * Khalti redirects the user's browser here with query params:
 *   pidx, transaction_id, amount (paisa), status, purchase_order_id, ...
 *
 * Verification chain (all steps must pass):
 *   1. A pidx must be present and match an existing payment (by provider_ref).
 *   2. The authoritative status comes from Khalti's lookup API
 *      (server-to-server with the secret key) — the browser's `status`
 *      query param is never trusted.
 *   3. The lookup amount (paisa) must match the payment row.
 * Only then is the payment fulfilled (membership activated).
 */

function redirectUrl(path: '/payment/success' | '/payment/failed', params: Record<string, string>) {
  const url = new URL(path, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const khalti = getKhaltiConfig();
  if (!khalti) {
    return redirectUrl('/payment/failed', { reason: 'gateway_unconfigured' });
  }

  const url = new URL(request.url);
  const pidx = url.searchParams.get('pidx');
  if (!pidx) {
    return redirectUrl('/payment/failed', { reason: 'missing_pidx' });
  }

  // 1. Find the matching payment via the stored pidx.
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payments')
    .select('id, status, user_id, plan_id, amount, transaction_uuid, plan:plans(billing_cycle)')
    .eq('provider_ref', pidx)
    .maybeSingle();

  if (!payment) {
    return redirectUrl('/payment/failed', { reason: 'payment_not_found' });
  }

  // 2. Authoritative status via Khalti's lookup API.
  const lookup = await lookupKhaltiPayment(pidx, khalti);
  const raw = {
    pidx,
    query_status: url.searchParams.get('status'),
    lookup_status: lookup.status,
    transaction_id: lookup.transactionId,
  };

  // 3. Amount check — Khalti reports paisa (1 NPR = 100 paisa).
  if (lookup.totalAmount !== undefined && lookup.totalAmount !== Math.round(Number(payment.amount) * 100)) {
    console.error('[khalti.callback] Amount mismatch', payment.transaction_uuid);
    await markPaymentFailed(payment.id, raw);
    return redirectUrl('/payment/failed', { reason: 'amount_mismatch' });
  }

  if (!lookup.ok) {
    await markPaymentFailed(payment.id, raw);
    return redirectUrl('/payment/failed', { reason: lookup.status.toLowerCase() });
  }

  const planJoin = payment.plan as unknown as { billing_cycle: BillingCycle } | null;
  const result = await fulfillPayment({
    paymentId: payment.id,
    userId: payment.user_id,
    planId: payment.plan_id,
    billingCycle: planJoin?.billing_cycle ?? 'monthly',
    providerRef: lookup.transactionId ?? pidx,
    raw,
  });
  if (!result.ok) {
    console.error('[khalti.callback] Fulfillment failed', result.message);
    return redirectUrl('/payment/failed', { reason: 'fulfillment' });
  }

  return redirectUrl('/payment/success', { ref: lookup.transactionId ?? '' });
}
