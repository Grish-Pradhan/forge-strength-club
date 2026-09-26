import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the SERVICE ROLE key.
 *
 * ⚠️ NEVER import this file from a Client Component and NEVER expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. It bypasses RLS entirely.
 *
 * Used exclusively inside Server Actions / Route Handlers that have ALREADY
 * verified (with the user-scoped client) that the caller is an admin.
 */
let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Admin write operations require it.',
    );
  }
  if (!adminClient) {
    adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
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
