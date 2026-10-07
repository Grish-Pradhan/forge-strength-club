import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  createClient as createPlainClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client bound to the request's cookies.
 * Use in Server Components, Server Actions and Route Handlers.
 * Runs AS the signed-in user — RLS applies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware refreshes
            // sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Cookieless anon client for PUBLIC reads (classes, plans, announcements,
 * site content — all `using (true)` RLS policies).
 *
 * Why: `cookies()` is a dynamic API — touching it in a Server Component
 * forces the route to render on every request. This client never touches
 * cookies, so routes using it can be statically cached + revalidated (ISR).
 * Module-level singleton — shared safely across renders.
 */
let publicClient: SupabaseClient | null = null;

export function createPublicClient(): SupabaseClient {
  if (!publicClient) {
    publicClient = createPlainClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return publicClient;
}
