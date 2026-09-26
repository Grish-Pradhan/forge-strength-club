import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client (anon key).
 * Singleton per browser tab — safe to call from any Client Component.
 * RLS applies to every query made with this client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** True when Supabase env vars are present (lets the UI degrade gracefully). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
