import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * eSewa ePay v2 integration (server-only).
 *
 * Docs: https://developer.esewa.com.np/#/epay
 *
 * Test environment works out of the box with the public sandbox credentials
 * (merchant code EPAYTEST) — no registration required:
 *   - Form URL:  https://rc-epay.esewa.com.np/api/epay/main/v2/form
 *   - Status:    https://rc.esewa.com.np/api/epay/transaction/status/
 * Production uses the merchant's real credentials on epay.esewa.com.np.
 *
 * Security model:
 *   - The signature is an HMAC-SHA256 (base64) over the signed field names,
 *     computed with the merchant secret key — server-side only.
 *   - Every callback is signature-verified (timing-safe) AND cross-checked
 *     against eSewa's transaction status API before a payment is marked
 *     completed. The client can never forge a success.
 */

export type EsewaEnv = 'test' | 'prod';

export interface EsewaConfig {
  productCode: string;
  secretKey: string;
  env: EsewaEnv;
}

const FORM_URL: Record<EsewaEnv, string> = {
  test: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
  prod: 'https://epay.esewa.com.np/api/epay/main/v2/form',
};

const STATUS_URL: Record<EsewaEnv, string> = {
  test: 'https://rc.esewa.com.np/api/epay/transaction/status/',
  prod: 'https://epay.esewa.com.np/api/epay/transaction/status/',
};

/** Default public eSewa sandbox credentials (safe for test mode only). */
const ESEWA_TEST_PRODUCT_CODE = 'EPAYTEST';
const ESEWA_TEST_SECRET_KEY = '8gBm/:&EnhH.1/q';

/** Read eSewa config from env. Falls back to sandbox credentials in test mode. */
export function getEsewaConfig(): EsewaConfig {
  const env = (process.env.ESEWA_ENV as EsewaEnv) || 'test';
  return {
    productCode: process.env.ESEWA_MERCHANT_CODE || ESEWA_TEST_PRODUCT_CODE,
    secretKey: process.env.ESEWA_SECRET_KEY || ESEWA_TEST_SECRET_KEY,
    env,
  };
}

export interface EsewaFormInput {
  /** Amount WITHOUT tax/fees, in NPR. */
  amount: number;
  /** Our unique transaction UUID (payments.transaction_uuid). */
  transactionUuid: string;
  successUrl: string;
  failureUrl: string;
}

export interface EsewaFormOutput {
  action: string;
  fields: Record<string, string>;
}

/**
 * Build the auto-submitable form payload for eSewa ePay v2.
 * The signed message MUST exactly match the field values — we format the
 * amount once (toFixed(2)) and reuse the same string everywhere.
 */
export function buildEsewaForm(input: EsewaFormInput, config: EsewaConfig): EsewaFormOutput {
  const amount = input.amount.toFixed(2);
  const signedFieldNames = 'total_amount,transaction_uuid,product_code';
  const message = `total_amount=${amount},transaction_uuid=${input.transactionUuid},product_code=${config.productCode}`;
  const signature = createHmac('sha256', config.secretKey).update(message).digest('base64');

  return {
    action: FORM_URL[config.env],
    fields: {
      amount,
      tax_amount: '0',
      total_amount: amount,
      transaction_uuid: input.transactionUuid,
      product_code: config.productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: input.successUrl,
      failure_url: input.failureUrl,
      signed_field_names: signedFieldNames,
      signature,
    },
  };
}

/** Payload eSewa base64-encodes into the `response` form field on callback. */
export interface EsewaCallbackPayload {
  transaction_code: string;
  status: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

/** Decode the base64 `response` field eSewa POSTs to the success/failure URL. */
export function decodeEsewaResponse(raw: string): EsewaCallbackPayload | null {
  try {
    const json = Buffer.from(raw, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as EsewaCallbackPayload;
    if (!payload.transaction_uuid || !payload.status) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Timing-safe string comparison (avoids timing attacks on signatures). */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify the HMAC signature on an eSewa callback payload.
 * Recomputes the signature from the signed fields listed in the payload.
 */
export function verifyEsewaSignature(payload: EsewaCallbackPayload, config: EsewaConfig): boolean {
  if (!payload.signature || !payload.signed_field_names) return false;

  const values: Record<string, string> = {
    transaction_code: payload.transaction_code ?? '',
    status: payload.status ?? '',
    total_amount: payload.total_amount ?? '',
    transaction_uuid: payload.transaction_uuid ?? '',
    product_code: payload.product_code ?? '',
  };

  const message = payload.signed_field_names
    .split(',')
    .map((field) => `${field}=${values[field] ?? ''}`)
    .join(',');

  const expected = createHmac('sha256', config.secretKey).update(message).digest('base64');
  return safeCompare(expected, payload.signature);
}

export interface EsewaStatusResult {
  ok: boolean;
  status: string;
  totalAmount?: string;
  transactionCode?: string;
}

/**
 * Cross-verify a transaction with eSewa's server-to-server status API.
 * Guarantees the callback wasn't forged even if the merchant secret leaked.
 */
export async function checkEsewaStatus(
  transactionUuid: string,
  totalAmount: string,
  config: EsewaConfig,
): Promise<EsewaStatusResult> {
  const url = new URL(STATUS_URL[config.env]);
  url.searchParams.set('product_code', config.productCode);
  url.searchParams.set('total_amount', totalAmount);
  url.searchParams.set('transaction_uuid', transactionUuid);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: `HTTP_${res.status}` };
    const data = (await res.json()) as { status?: string; total_amount?: string; transaction_code?: string };
    return {
      ok: data.status === 'COMPLETE',
      status: data.status ?? 'UNKNOWN',
      totalAmount: data.total_amount,
      transactionCode: data.transaction_code,
    };
  } catch (err) {
    console.error('[esewa.checkStatus]', err);
    return { ok: false, status: 'NETWORK_ERROR' };
  }
}
