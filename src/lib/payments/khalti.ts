/**
 * Khalti Payment Gateway v2 (ePayment API) — server-only.
 *
 * Docs: https://docs.khalti.com/khalti-epayment/api/
 *
 * Test environment: https://a.khalti.com/api/v2 (requires a sandbox secret
 * key from merchant.khalti.com). Production: https://khalti.com/api/v2.
 *
 * Security model:
 *   - Initiation happens server-to-server with the secret key (the amount
 *     never comes from the browser).
 *   - Every callback is verified via the lookup API with the pidx before a
 *     payment is marked completed — the client can never forge a success.
 */

export type KhaltiEnv = 'test' | 'prod';

const BASE_URL: Record<KhaltiEnv, string> = {
  test: 'https://a.khalti.com/api/v2',
  prod: 'https://khalti.com/api/v2',
};

/** Read Khalti config from env. Returns null when not configured. */
export function getKhaltiConfig(): { secretKey: string; env: KhaltiEnv } | null {
  const secretKey = process.env.KHALTI_SECRET_KEY;
  if (!secretKey) return null;
  const env = (process.env.KHALTI_ENV as KhaltiEnv) || 'test';
  return { secretKey, env };
}

export interface KhaltiInitiateInput {
  /** Amount in NPR (converted to paisa internally). */
  amount: number;
  /** Our unique transaction UUID (payments.transaction_uuid). */
  purchaseOrderId: string;
  purchaseOrderName: string;
  returnUrl: string;
  websiteUrl: string;
  customerName?: string;
  customerEmail?: string;
}

export interface KhaltiInitiateResult {
  ok: boolean;
  pidx?: string;
  paymentUrl?: string;
  error?: string;
}

/**
 * Initiate a Khalti payment (server-to-server).
 * Returns a `payment_url` the browser must be redirected to.
 */
export async function initiateKhaltiPayment(
  input: KhaltiInitiateInput,
  config: { secretKey: string; env: KhaltiEnv },
): Promise<KhaltiInitiateResult> {
  try {
    const res = await fetch(`${BASE_URL[config.env]}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        return_url: input.returnUrl,
        website_url: input.websiteUrl,
        // Khalti expects the amount in paisa (1 NPR = 100 paisa).
        amount: Math.round(input.amount * 100),
        purchase_order_id: input.purchaseOrderId,
        purchase_order_name: input.purchaseOrderName,
        ...(input.customerName || input.customerEmail
          ? {
              customer_info: {
                ...(input.customerName ? { name: input.customerName } : {}),
                ...(input.customerEmail ? { email: input.customerEmail } : {}),
              },
            }
          : {}),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      pidx?: string;
      payment_url?: string;
      detail?: string | { amount?: string[] };
    };

    if (!res.ok || !data.payment_url) {
      const detail =
        typeof data.detail === 'string'
          ? data.detail
          : data.detail?.amount?.join(', ') || `HTTP ${res.status}`;
      return { ok: false, error: `Khalti initiation failed: ${detail}` };
    }

    return { ok: true, pidx: data.pidx, paymentUrl: data.payment_url };
  } catch (err) {
    console.error('[khalti.initiate]', err);
    return { ok: false, error: 'Could not reach the Khalti payment gateway.' };
  }
}

export interface KhaltiLookupResult {
  ok: boolean;
  status: string;
  totalAmount?: number;
  transactionId?: string;
}

/**
 * Look up a payment's authoritative status via Khalti's lookup API.
 * `ok` is true only when status === 'Completed'.
 */
export async function lookupKhaltiPayment(
  pidx: string,
  config: { secretKey: string; env: KhaltiEnv },
): Promise<KhaltiLookupResult> {
  try {
    const res = await fetch(`${BASE_URL[config.env]}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ pidx }),
    });

    if (!res.ok) return { ok: false, status: `HTTP_${res.status}` };

    const data = (await res.json()) as {
      status?: string;
      total_amount?: number;
      transaction_id?: string;
    };

    return {
      ok: data.status === 'Completed',
      status: data.status ?? 'UNKNOWN',
      totalAmount: data.total_amount,
      transactionId: data.transaction_id,
    };
  } catch (err) {
    console.error('[khalti.lookup]', err);
    return { ok: false, status: 'NETWORK_ERROR' };
  }
}
