'use server';

import { createClient } from '@/lib/supabase/server';
import { writeAuditEvent } from '@/lib/audit';

export interface MemberActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

function friendlyBookingError(raw: string): string {
  if (raw.includes('CLASS_FULL')) return 'This class is at capacity — try another slot.';
  if (raw.includes('ALREADY_BOOKED')) return 'You already have a spot in this class.';
  if (raw.includes('MEMBERSHIP_INACTIVE')) return 'Your membership is not active.';
  if (raw.includes('CLASS_STARTED')) return 'This class has already started.';
  if (raw.includes('NOT_AUTHENTICATED')) return 'Please sign in again.';
  return raw;
}

export async function bookClassAction(classId: string): Promise<MemberActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };

  const { data, error } = await supabase.rpc('book_class', { p_class_id: classId });
  const { data: gymClass } = await supabase
    .from('classes')
    .select('title')
    .eq('id', classId)
    .maybeSingle();

  if (error) {
    await writeAuditEvent({
      eventType: 'booking_failed',
      category: 'booking',
      severity: 'warning',
      actorId: user.id,
      path: '/dashboard/bookings',
      description: `Could not book ${gymClass?.title ?? 'a class'}.`,
      metadata: { class_id: classId, reason: friendlyBookingError(error.message) },
    });
    return { ok: false, message: friendlyBookingError(error.message) };
  }

  await writeAuditEvent({
    eventType: 'booking_created',
    category: 'booking',
    severity: 'success',
    actorId: user.id,
    path: '/dashboard/bookings',
    description: `Booked ${gymClass?.title ?? 'a class'}.`,
    metadata: { class_id: classId, booking_id: String(data) },
  });
  return { ok: true, id: String(data) };
}

export async function cancelBookingAction(bookingId: string): Promise<MemberActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };

  const { data: booking } = await supabase
    .from('bookings')
    .select('id,class_id,class:classes(title)')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!booking) return { ok: false, message: 'Booking not found.' };

  const { error } = await supabase
    .from('bookings')
    .update({ booking_status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id);
  if (error) return { ok: false, message: error.message };

  const joinedClass = booking.class as unknown as { title?: string } | null;
  await writeAuditEvent({
    eventType: 'booking_cancelled',
    category: 'booking',
    severity: 'info',
    actorId: user.id,
    path: '/dashboard/bookings',
    description: `Cancelled ${joinedClass?.title ?? 'a class booking'}.`,
    metadata: { class_id: booking.class_id, booking_id: bookingId },
  });
  return { ok: true };
}
