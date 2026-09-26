'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Booking, ClassWithCount } from '@/lib/types';

/**
 * Member data hooks (React Query + Supabase browser client).
 * All queries run under the member's own identity — RLS limits bookings
 * to their own rows automatically.
 */

const supabase = () => createClient();

/** Bookings query key (shared so mutations invalidate precisely). */
export const bookingsKey = ['bookings', 'me'] as const;

/** Fetch my upcoming bookings with joined class data. */
export function useMyBookings() {
  return useQuery({
    queryKey: bookingsKey,
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase()
        .from('bookings')
        .select('*, class:classes(*)')
        .eq('booking_status', 'confirmed')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Booking[]) ?? [];
    },
  });
}

/** Fetch upcoming bookable classes with live booked counts. */
export function useBookableClasses() {
  return useQuery({
    queryKey: ['classes', 'bookable'],
    queryFn: async (): Promise<ClassWithCount[]> => {
      const { data, error } = await supabase()
        .from('classes_public')
        .select('*')
        .gte('schedule_time', new Date().toISOString())
        .order('schedule_time', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as ClassWithCount[]) ?? [];
    },
  });
}

/**
 * Book a class in ONE CLICK via the book_class RPC.
 * The RPC enforces capacity + membership atomically server-side
 * (race-condition safe) — friendly error messages are returned to the UI.
 */
export function useBookClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      const { data, error } = await supabase().rpc('book_class', { p_class_id: classId });
      if (error) throw new Error(friendlyBookingError(error.message));
      return data as string;
    },
    onSuccess: () => {
      // Refresh booked counts + my bookings immediately.
      void queryClient.invalidateQueries({ queryKey: bookingsKey });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

/** Cancel a booking (RLS: only own rows). */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase()
        .from('bookings')
        .update({ booking_status: 'cancelled' })
        .eq('id', bookingId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKey });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

/** Map raw PostgREST exception messages to friendly copy. */
function friendlyBookingError(raw: string): string {
  if (raw.includes('CLASS_FULL')) return 'This class is at capacity — try another slot.';
  if (raw.includes('ALREADY_BOOKED')) return 'You already have a spot in this class.';
  if (raw.includes('MEMBERSHIP_INACTIVE'))
    return 'Your membership is not active. Visit your profile or the front desk to renew.';
  if (raw.includes('CLASS_STARTED')) return 'This class has already started.';
  if (raw.includes('NOT_AUTHENTICATED')) return 'Please sign in again.';
  return raw;
}
