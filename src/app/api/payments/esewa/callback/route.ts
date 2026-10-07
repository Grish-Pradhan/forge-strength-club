import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkEsewaStatus,
  decodeEsewaResponse,
  getEsewaConfig,
  verifyEsewaSignature,
  type EsewaCallbackPayload,
} from '@/lib/payments/esewa';
import { fulfillPayment, markPaymentFailed } from '@/lib/payments/service';
import type { BillingCycle } from '@/lib/types';

/**
 * POST /api/payments/esewa/callback — eSewa ePay v2 success/failure URL.
 *
 * eSewa POSTs a form-urlencoded body with a single `response` field holding
 * a base64-encoded, signed JSON payload.
 *
 * Verification chain (all steps must pass):
 *   1. Decode + parse the response payload.
 *   2. HMAC signature verification (timing-safe, merchant secret).
 *   3. The payload's transaction_uuid must match an existing pending payment.
 *   4. The amount must match the payment row (no tampering).
 *   5. Cross-verified against eSewa's transaction status API.
 * Only then is the payment fulfilled (membership activated).
 */

function redirectUrl(path: '/payment/success' | '/payment/failed', params: Record<string, string>) {
  const url = new URL(path, process.env.NEXT_PUBLIC_SITE_URL || 'https://forgestrengthclub.vercel.app');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const esewa = getEsewaConfig();

  // 1. Parse the form-encoded callback body.
  let rawResponse: string | null = null;
  try {
    const form = await request.formData();
    rawResponse = form.get('response') as string | null;
  } catch {
    rawResponse = null;
  }

  if (!rawResponse) {
    return redirectUrl('/payment/failed', { reason: 'empty_response' });
  }

  // 2. Decode + verify the signature.
  const payload = decodeEsewaResponse(rawResponse);
  if (!payload) {
    return redirectUrl('/payment/failed', { reason: 'malformed_response' });
  }
  if (!verifyEsewaSignature(payload, esewa)) {
    console.error('[esewa.callback] Invalid signature', payload.transaction_uuid);
    return redirectUrl('/payment/failed', { reason: 'invalid_signature' });
  }

  // 3. Find the matching pending payment.
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from('payments')
    .select('id, status, user_id, plan_id, amount, provider, plan:plans(billing_cycle)')
    .eq('transaction_uuid', payload.transaction_uuid)
    .maybeSingle();

  if (!payment) {
    return redirectUrl('/payment/failed', { reason: 'payment_not_found' });
  }

  const raw = payload as unknown as Record<string, unknown>;

  // 4. Amount check — eSewa reports "total_amount" as a string.
  const reportedAmount = Number(payload.total_amount);
  if (!Number.isFinite(reportedAmount) || reportedAmount !== Number(payment.amount)) {
    console.error('[esewa.callback] Amount mismatch', payload.transaction_uuid);
    await markPaymentFailed(payment.id, raw);
    return redirectUrl('/payment/failed', { reason: 'amount_mismatch' });
  }

  // 5a. Gateway reported success → cross-verify with eSewa's status API.
  if (payload.status === 'COMPLETE') {
    const status = await checkEsewaStatus(
      payload.transaction_uuid,
      payload.total_amount,
      esewa,
    );
    if (!status.ok) {
      console.error('[esewa.callback] Status API did not confirm', status.status);
      await markPaymentFailed(payment.id, raw);
      return redirectUrl('/payment/failed', { reason: 'unconfirmed' });
    }

    const planJoin = payment.plan as unknown as { billing_cycle: BillingCycle } | null;
    const result = await fulfillPayment({
      paymentId: payment.id,
      userId: payment.user_id,
      planId: payment.plan_id,
      billingCycle: planJoin?.billing_cycle ?? 'monthly',
      providerRef: payload.transaction_code ?? status.transactionCode ?? '',
      raw,
    });
    if (!result.ok) {
      console.error('[esewa.callback] Fulfillment failed', result.message);
      return redirectUrl('/payment/failed', { reason: 'fulfillment' });
    }

    return redirectUrl('/payment/success', { ref: payload.transaction_code ?? '' });
  }

  // 5b. Gateway reported failure / cancellation.
  await markPaymentFailed(payment.id, raw);
  return redirectUrl('/payment/failed', { reason: payload.status.toLowerCase() });
}
