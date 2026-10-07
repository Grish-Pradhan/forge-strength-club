import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writeAuditEvent } from '@/lib/audit';
import { isThemeKey, THEMES } from '@/lib/themes';

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  // Cookie-authenticated writes are same-origin only (also disallows CSRF).
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply({ error: 'Cross-site requests are not allowed.' }, 403);
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply({ error: 'Please sign in again.' }, 401);

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) return reply({ error: 'Unable to verify your permissions. Please try again.' }, 503);
    if (profile?.role !== 'admin') {
      await writeAuditEvent({
        eventType: 'forbidden_theme_update', category: 'security', severity: 'warning',
        actorId: user.id, path: '/api/admin/theme',
        description: 'A member attempted to change the global website theme.',
      }, request.headers);
      return reply({ error: 'Only administrators can change the global theme.' }, 403);
    }

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return reply({ error: 'Send a JSON object containing a theme key.' }, 415);
    }
    // Read with a bound rather than trusting Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: 'A theme is required.' }, 400);
    let raw = '';
    let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return reply({ error: 'The theme request is too large.' }, 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
    const theme = body && typeof body === 'object' && 'theme' in body ? body.theme : null;
    if (!isThemeKey(theme)) return reply({ error: 'Choose one of the five available themes.' }, 400);

    const { data, error } = await createAdminClient()
      .from('global_theme').update({ theme_key: theme }).eq('id', 1)
      .select('theme_key,version,updated_at').single();
    if (error || !data) {
      console.error('[theme update]', error?.message);
      return reply({ error: 'The theme could not be saved. Please try again.' }, 503);
    }
    await writeAuditEvent({
      eventType: 'global_theme_changed', category: 'admin', severity: 'success',
      actorId: user.id, path: '/admin',
      description: `Changed the entire website theme to ${THEMES.find((item) => item.key === theme)!.name}.`,
      metadata: { theme, version: data.version },
    }, request.headers);
    return reply({ theme: data.theme_key, version: data.version, updatedAt: data.updated_at });
  } catch (error) {
    console.error('[theme API]', error);
    return reply({ error: 'Unable to save the theme right now. Please try again.' }, 503);
  }
}
