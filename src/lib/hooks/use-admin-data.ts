'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { getUserAuthStatusAction } from '@/app/actions/admin';
import type { Announcement, AdminUserRow, ClassWithCount, EmailAuthStatus, Plan } from '@/lib/types';

/**
 * Admin data hooks — READS go through the anon-key browser client
 * (RLS-verified admin sees everything via the is_admin() policies);
 * WRITES go through the guarded Server Actions in app/actions/admin.ts.
 */

const supabase = () => createClient();

/* ---------- Reads ---------- */

/** All users (profiles joined with plan + booking stats). */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase()
        .from('profiles')
        .select('*, plan:plans(name), bookings(count)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as AdminUserRow[]).map((row) => {
        const withPlan = row as AdminUserRow & {
          plan?: { name: string } | null;
          bookings?: { count: number }[];
        };
        return {
          ...row,
          booking_count: withPlan.bookings?.[0]?.count ?? 0,
          // Flatten the joined plan name for the table.
          ...(withPlan.plan ? { plan_name: withPlan.plan.name } : {}),
        } as AdminUserRow;
      });
    },
  });
}

/** All classes with live booked counts. */
export function useAdminClasses() {
  return useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: async (): Promise<ClassWithCount[]> => {
      const { data, error } = await supabase()
        .from('classes_public')
        .select('*')
        .order('schedule_time', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as ClassWithCount[]) ?? [];
    },
  });
}

/** All plans (including inactive). */
export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase()
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as Plan[]) ?? [];
    },
  });
}

/** All announcements (including inactive). */
export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase()
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Announcement[]) ?? [];
    },
  });
}

/** Landing-page copy. */
export function useAdminSiteContent() {
  return useQuery({
    queryKey: ['admin', 'site_content'],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase().from('site_content').select('key,value');
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    },
  });
}

/**
 * Live email-confirmation state for the given users, fetched from Supabase
 * Auth via a guarded Server Action (the browser client cannot read
 * auth.users directly, and profiles intentionally don't mirror the flag).
 * Invalidated by useAdminMutation's ['admin'] sweep after a verify action.
 */
export function useAdminEmailStatus(ids: string[]) {
  const key = ids.join(',');
  return useQuery({
    queryKey: ['admin', 'email-status', key],
    queryFn: async (): Promise<Record<string, EmailAuthStatus>> => {
      const result = await getUserAuthStatusAction(ids);
      if (!result.ok || !result.statuses) {
        throw new Error(result.message ?? 'Could not load email verification status.');
      }
      return result.statuses;
    },
    enabled: ids.length > 0,
    staleTime: 30_000, // verification state rarely changes on its own
  });
}

/* ---------- Write-mutation factory ---------- */

/**
 * Build a React Query mutation around an admin Server Action.
 * On success, invalidates admin tables + public reads so every view
 * (including the landing page) refreshes instantly.
 */
export function useAdminMutation<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<{ ok: boolean; message?: string }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const result = await action(...args);
      if (!result.ok) throw new Error(result.message ?? 'Action failed.');
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
