import { createAdminClient } from '@/lib/supabase/admin';
import type { BillingCycle } from '@/lib/types';

/**
 * Payment fulfillment service (server-only, service-role client).
 * Used by the eSewa / Khalti callback routes AFTER the gateway response has
 * been verified (signature + status API). Members can never call this
 * directly — it bypasses RLS and is reachable only from verified callbacks.
 */

export interface FulfillPaymentInput {
  paymentId: string;
  userId: string;
  planId: string | null;
  billingCycle: BillingCycle | null;
  providerRef: string;
  /** Full verified gateway response — stored for audit/debug. */
  raw: Record<string, unknown>;
}

export interface FulfillPaymentResult {
  ok: boolean;
  message?: string;
}

/** Compute the new membership expiry from a completed payment. */
export function computeExpiry(cycle: BillingCycle | null, from = new Date()): Date {
  const d = new Date(from);
  if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Mark a payment completed and activate the member's plan.
 * Idempotent: if the payment is already completed, this is a no-op success
 * (gateways sometimes retry callbacks).
 */
export async function fulfillPayment(input: FulfillPaymentInput): Promise<FulfillPaymentResult> {
  const admin = createAdminClient();

  // 1. Read the payment row (service role — full access).
  const { data: payment } = await admin
    .from('payments')
    .select('id, status, user_id, plan_id, provider')
    .eq('id', input.paymentId)
    .maybeSingle();

  if (!payment) return { ok: false, message: 'Payment record not found.' };

  if (payment.status === 'completed') return { ok: true };

  // 2. Flip the payment to completed + store the gateway reference/response.
  const { error: updateError } = await admin
    .from('payments')
    .update({
      status: 'completed',
      provider_ref: input.providerRef,
      response: input.raw,
    })
    .eq('id', input.paymentId);
  if (updateError) {
    console.error('[payments.fulfill]', updateError.message);
    return { ok: false, message: 'Could not update the payment record.' };
  }

  // 3. Activate membership: status + plan + expiry (extends from the old
  //    expiry when renewing early so members never lose paid days).
  const { data: profile } = await admin
    .from('profiles')
    .select('membership_expires_at')
    .eq('id', input.userId)
    .maybeSingle();

  const cycle = input.billingCycle ?? 'monthly';
  const previousExpiry = profile?.membership_expires_at
    ? new Date(profile.membership_expires_at)
    : null;
  const base = previousExpiry && previousExpiry > new Date() ? previousExpiry : new Date();
  const expiresAt = computeExpiry(cycle, base);

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      membership_status: 'active',
      ...(input.planId ? { plan_id: input.planId } : {}),
      membership_expires_at: expiresAt.toISOString(),
    })
    .eq('id', input.userId);

  if (profileError) {
    console.error('[payments.fulfill.profile]', profileError.message);
    return { ok: false, message: 'Payment recorded but membership activation failed.' };
  }

  return { ok: true };
}

/** Mark a payment failed (callback verified a cancelled/rejected payment). */
export async function markPaymentFailed(
  paymentId: string,
  raw: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('payments')
    .update({ status: 'failed', response: raw })
    .eq('id', paymentId);
}
