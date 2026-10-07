import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 *
 * ⚠️ NEVER import this file from a Client Component and NEVER expose
 * SUPABASE_SECRET_KEY (or the legacy service-role key) to the browser.
 * It bypasses RLS entirely.
 *
 * Used exclusively inside Server Actions / Route Handlers that have ALREADY
 * verified (with the user-scoped client) that the caller is an admin.
 */
let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. Admin write operations require it.',
    );
  }
  if (!adminClient) {
    adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return adminClient;
}
