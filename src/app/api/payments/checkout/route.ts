import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildEsewaForm, getEsewaConfig } from '@/lib/payments/esewa';
import { getKhaltiConfig, initiateKhaltiPayment } from '@/lib/payments/khalti';
import type { BillingCycle } from '@/lib/types';

/**
 * POST /api/payments/checkout — start an online membership payment.
 *
 * Body: { plan_id: string, provider: 'esewa' | 'khalti' }
 *
 * Flow (server-verified every step):
 *   1. The caller must be signed in (JWT validated via the user client).
 *   2. The plan must exist and be active — the AMOUNT is read from the plan
 *      row server-side, never trusted from the browser.
 *   3. A pending `payments` row is created (service-role client).
 *   4. eSewa: returns a signed form the client auto-submits.
 *      Khalti: initiates server-to-server and returns a payment URL.
 *
 * Fulfillment happens in the gateway callback routes, after signature +
 * status-API verification — this route never marks anything as paid.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      plan_id?: string;
      provider?: string;
    } | null;

    const planId = body?.plan_id;
    const provider = body?.provider;

    if (!planId || !UUID_RE.test(planId)) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
    }
    if (provider !== 'esewa' && provider !== 'khalti') {
      return NextResponse.json({ error: 'Invalid payment provider.' }, { status: 400 });
    }

    // 1. Verify the session.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
    }

    // 2. Load the plan server-side (amount is authoritative from the DB).
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, price, billing_cycle, is_active')
      .eq('id', planId)
      .maybeSingle();

    if (!plan || !plan.is_active) {
      return NextResponse.json({ error: 'This plan is not available.' }, { status: 404 });
    }

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'This plan has an invalid price.' }, { status: 400 });
    }
    const billingCycle = (plan.billing_cycle as BillingCycle) ?? 'monthly';

    // 3. Create the pending payment row.
    const transactionUuid = randomUUID();
    const admin = createAdminClient();
    const { data: payment, error: insertError } = await admin
      .from('payments')
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        provider,
        amount,
        currency: 'NPR',
        status: 'pending',
        transaction_uuid: transactionUuid,
      })
      .select('id')
      .single();

    if (insertError || !payment) {
      console.error('[payments.checkout]', insertError?.message);
      return NextResponse.json(
        { error: 'Could not start the payment. Please try again.' },
        { status: 500 },
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const customerName = user.user_metadata?.full_name as string | undefined;

    // 4a. eSewa — return a signed auto-submitable form.
    if (provider === 'esewa') {
      const esewa = getEsewaConfig();
      const form = buildEsewaForm(
        {
          amount,
          transactionUuid,
          successUrl: `${siteUrl}/api/payments/esewa/callback`,
          failureUrl: `${siteUrl}/api/payments/esewa/callback`,
        },
        esewa,
      );
      return NextResponse.json({ provider, type: 'form', ...form });
    }

    // 4b. Khalti — initiate server-to-server, return the payment URL.
    const khalti = getKhaltiConfig();
    if (!khalti) {
      return NextResponse.json(
        { error: 'Khalti is not configured yet — please pay with eSewa.' },
        { status: 503 },
      );
    }

    const init = await initiateKhaltiPayment(
      {
        amount,
        purchaseOrderId: transactionUuid,
        purchaseOrderName: `Forge ${plan.name} membership (${billingCycle})`,
        returnUrl: `${siteUrl}/api/payments/khalti/callback`,
        websiteUrl: siteUrl,
        customerName,
        customerEmail: user.email ?? undefined,
      },
      khalti,
    );

    if (!init.ok || !init.paymentUrl) {
      await admin
        .from('payments')
        .update({ status: 'failed', response: { error: init.error } })
        .eq('id', payment.id);
      return NextResponse.json({ error: init.error ?? 'Payment initiation failed.' }, { status: 502 });
    }

    // Store the pidx so the callback can look this payment up.
    await admin
      .from('payments')
      .update({ provider_ref: init.pidx ?? null })
      .eq('id', payment.id);

    return NextResponse.json({ provider, type: 'redirect', url: init.paymentUrl });
  } catch (err) {
    console.error('[payments.checkout]', err);
    return NextResponse.json({ error: 'Payment initiation failed.' }, { status: 500 });
  }
}
