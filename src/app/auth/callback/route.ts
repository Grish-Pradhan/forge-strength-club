import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/audit';

/**
 * OAuth callback — exchanges the provider's auth code for a session,
 * sets the session cookies, then routes based on role:
 *   admin  -> /admin
 *   member -> /dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? null;

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await writeAuditEvent(
        {
          eventType: 'oauth_login_succeeded',
          category: 'auth',
          severity: 'success',
          actorId: data.user.id,
          actorEmail: data.user.email ?? null,
          path: '/auth/callback',
          description: 'Signed in with an OAuth provider.',
        },
        request.headers,
      );
      // Determine role for role-based routing.
      let destination = next || '/dashboard';
      if (!next) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile?.role === 'admin') destination = '/admin';
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }

    console.error('[auth/callback] exchange failed:', error?.message);
    await writeAuditEvent(
      {
        eventType: 'oauth_login_failed',
        category: 'auth',
        severity: 'warning',
        path: '/auth/callback',
        description: 'An OAuth sign-in attempt failed.',
        metadata: { reason: error?.message?.slice(0, 300) ?? 'Missing authorization code' },
      },
      request.headers,
    );
  }

  // Missing/invalid code — back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
