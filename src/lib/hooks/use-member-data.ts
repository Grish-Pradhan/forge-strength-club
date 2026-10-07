'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { bookClassAction, cancelBookingAction } from '@/app/actions/member';
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
        .select('*, class:classes!inner(*)')
        .eq('booking_status', 'confirmed')
        .gte('class.schedule_time', new Date().toISOString())
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
      const result = await bookClassAction(classId);
      if (!result.ok) throw new Error(result.message ?? 'Booking failed.');
      return result.id;
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
      const result = await cancelBookingAction(bookingId);
      if (!result.ok) throw new Error(result.message ?? 'Could not cancel booking.');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKey });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
