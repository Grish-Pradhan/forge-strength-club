import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestIp, writeAuditEvent } from '@/lib/audit';

const ALLOWED_EVENTS = new Set([
  'page_view',
  'login_succeeded',
  'login_failed',
  'registration_succeeded',
  'registration_failed',
  'logout',
]);

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 90;
const traffic = new Map<string, { startedAt: number; count: number; alerted: boolean }>();
const SUSPICIOUS_PATH = /(?:\.env|wp-admin|wp-login|\.php(?:\/|$)|\.git|etc\/passwd|\.\.\/|config\.json)/i;

function safePath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  return value.replace(/[\r\n\0]/g, '').slice(0, 500);
}

export async function POST(request: Request) {
  const ip = requestIp(request.headers) ?? 'unknown';
  const now = Date.now();
  if (traffic.size > 10_000) {
    for (const [key, value] of traffic) {
      if (now - value.startedAt > RATE_WINDOW_MS * 2) traffic.delete(key);
    }
  }
  const current = traffic.get(ip);
  const bucket =
    !current || now - current.startedAt >= RATE_WINDOW_MS
      ? { startedAt: now, count: 1, alerted: false }
      : { ...current, count: current.count + 1 };
  traffic.set(ip, bucket);

  if (bucket.count > RATE_LIMIT) {
    if (!bucket.alerted) {
      bucket.alerted = true;
      await writeAuditEvent(
        {
          eventType: 'activity_rate_limit',
          category: 'security',
          severity: 'warning',
          path: '/api/activity',
          description: 'Unusually high activity volume was blocked.',
          metadata: { requests_in_minute: bucket.count },
        },
        request.headers,
      );
    }
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    await writeAuditEvent(
      {
        eventType: 'invalid_activity_payload',
        category: 'security',
        severity: 'warning',
        path: '/api/activity',
        description: 'Malformed activity payload was rejected.',
      },
      request.headers,
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  if (!ALLOWED_EVENTS.has(eventType)) {
    await writeAuditEvent(
      {
        eventType: 'invalid_activity_event',
        category: 'security',
        severity: 'warning',
        path: '/api/activity',
        description: 'Unknown activity event was rejected.',
      },
      request.headers,
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = safePath(body.path);
  const suppliedEmail =
    typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : null;
  const suppliedName = typeof body.name === 'string' ? body.name.trim().slice(0, 150) : null;
  const failed = eventType.endsWith('_failed');
  const suspiciousProbe = eventType === 'page_view' && SUSPICIOUS_PATH.test(path);
  let verifiedActorId = user?.id ?? null;
  let verifiedActorName: string | null = null;
  let verifiedActorEmail = user?.email ?? null;

  if (eventType === 'login_succeeded' && !user) {
    await writeAuditEvent(
      {
        eventType: 'spoofed_auth_event',
        category: 'security',
        severity: 'warning',
        path: '/api/activity',
        description: 'An unverified sign-in success event was rejected.',
      },
      request.headers,
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (eventType === 'registration_succeeded' && !user && suppliedEmail) {
    const { data: registeredProfile } = await createAdminClient()
      .from('profiles')
      .select('id,full_name,email')
      .eq('email', suppliedEmail)
      .maybeSingle();
    if (registeredProfile) {
      verifiedActorId = registeredProfile.id;
      verifiedActorName = registeredProfile.full_name;
      verifiedActorEmail = registeredProfile.email;
    }
  }
  if (eventType === 'registration_succeeded' && !verifiedActorId) {
    await writeAuditEvent(
      {
        eventType: 'unverified_registration_event',
        category: 'security',
        severity: 'warning',
        path: '/api/activity',
        description: 'An unverified registration success event was rejected.',
      },
      request.headers,
    );
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const descriptions: Record<string, string> = {
    page_view: `Visited ${path}`,
    login_succeeded: 'Signed in successfully.',
    login_failed: 'A sign-in attempt failed.',
    registration_succeeded: 'Created a new account.',
    registration_failed: 'An account registration attempt failed.',
    logout: 'Signed out.',
  };

  await writeAuditEvent(
    {
      eventType,
      category: suspiciousProbe ? 'security' : eventType === 'page_view' ? 'activity' : 'auth',
      severity: suspiciousProbe
        ? 'critical'
        : failed
          ? 'warning'
          : eventType === 'page_view'
            ? 'info'
            : 'success',
      actorId: verifiedActorId,
      actorName: verifiedActorName ?? (failed ? suppliedName : null),
      actorEmail: verifiedActorEmail ?? (failed ? suppliedEmail : null),
      path,
      description: suspiciousProbe ? `Suspicious path probe detected: ${path}` : descriptions[eventType],
      metadata: verifiedActorId ? { identity: 'verified' } : { identity: 'unverified' },
    },
    request.headers,
  );

  return NextResponse.json({ ok: true });
}
