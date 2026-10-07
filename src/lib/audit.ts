import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditCategory, AuditSeverity, Json } from '@/lib/types';

interface HeaderReader {
  get(name: string): string | null;
}

export interface AuditInput {
  eventType: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  path?: string | null;
  description: string;
  metadata?: Record<string, Json>;
}

export function requestIp(source: HeaderReader): string | null {
  const candidate =
    source.get('cf-connecting-ip') ??
    source.get('x-real-ip') ??
    source.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Append an admin-only audit record. Logging failures never break the action
 * being recorded, but they are surfaced in server logs for operations review.
 */
export async function writeAuditEvent(
  input: AuditInput,
  requestHeaders?: HeaderReader,
): Promise<void> {
  try {
    const source = requestHeaders ?? (await headers());
    const admin = createAdminClient();
    let actorName = input.actorName ?? null;
    let actorEmail = input.actorEmail ?? null;

    if (input.actorId && (!actorName || !actorEmail)) {
      const { data } = await admin
        .from('profiles')
        .select('full_name,email')
        .eq('id', input.actorId)
        .maybeSingle();
      actorName ||= data?.full_name ?? null;
      actorEmail ||= data?.email ?? null;
    }

    const { error } = await admin.from('audit_events').insert({
      event_type: input.eventType.slice(0, 80),
      category: input.category,
      severity: input.severity ?? 'info',
      actor_id: input.actorId ?? null,
      actor_name: actorName,
      actor_email: actorEmail,
      ip_address: requestIp(source),
      path: input.path?.slice(0, 500) ?? null,
      description: input.description.slice(0, 1000),
      metadata: input.metadata ?? {},
      user_agent: source.get('user-agent')?.slice(0, 500) ?? null,
    });

    if (error) console.error('[audit insert]', error.message);
  } catch (error) {
    console.error('[audit write]', error);
  }
}
