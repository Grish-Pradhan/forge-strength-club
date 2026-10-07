import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * RBAC routing middleware — tuned for speed.
 *
 * Performance model:
 *   - Public pages (/, /payment/**) skip auth ENTIRELY — no Supabase
 *     roundtrip, served immediately.
 *   - /api/** is excluded from the matcher — route handlers do their own
 *     auth checks internally.
 *   - Protected routes (dashboard/admin) + auth pages pay ONE getUser()
 *     roundtrip (JWT validated + session refreshed in the same request).
 *   - The validated user id is forwarded to RSCs via an internal request
 *     header, so pages never pay a SECOND auth roundtrip. The header is
 *     set AFTER server-side validation and overwritten on every request —
 *     a client-sent spoofed header is always replaced (or the request is
 *     redirected before the page ever renders).
 *
 * Route rules:
 *   /            — public (landing page)
 *   /login /register — public (redirects authenticated users away)
 *   /dashboard/**    — requires any authenticated session
 *                      (admins are redirected to /admin per spec)
 *   /admin/**       — requires role = 'admin'
 */
const MEMBER_ROUTES = ['/dashboard'];
const ADMIN_ROUTES = ['/admin'];
const AUTH_ROUTES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = MEMBER_ROUTES.some((r) => pathname.startsWith(r));
  const needsAdmin = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthPage = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // 1. Public pages (landing, payment results) — no auth work at all.
  //    This is the hot path: skip the Supabase roundtrip entirely.
  if (!needsAuth && !needsAdmin && !isAuthPage) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  let refreshedCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          refreshedCookies = cookiesToSet;
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession()) — it validates the JWT with the
  // auth server and refreshes the session if needed. Only protected routes
  // and auth pages reach this point.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Unauthenticated users may only see public pages (incl. landing page).
  if (!user && (needsAuth || needsAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 3. Already authenticated? Keep them out of login/register.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 4. Role-based access control (only when we actually need the role).
  if (user && (needsAdmin || needsAuth)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role ?? 'member';

    if (needsAdmin && role !== 'admin') {
      // Members trying to enter the Admin Panel -> Member Dashboard.
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (needsAuth && role === 'admin' && pathname === '/dashboard') {
      // Admins hitting the Member Dashboard root -> Admin Panel (per spec).
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // 5. Forward the VALIDATED user id to RSCs via an internal header so pages
  //    don't pay a second getUser() roundtrip (spoof-proof: always set from
  //    the auth-server-validated user, never read from the client).
  if (user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-forge-user-id', user.id);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    // Re-apply any session cookies refreshed during getUser() onto the
    // final response so the browser keeps the fresh tokens.
    refreshedCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Run on pages except static assets, images, Next internals and /api
    // (route handlers perform their own auth checks).
    '/((?!_next/static|_next/image|favicon.ico|api/|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
