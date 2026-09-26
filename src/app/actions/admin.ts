'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin Server Actions — full CRUD for users, classes, plans,
 * announcements and site content.
 *
 * SECURITY MODEL (two-phase, every action):
 *   1. requireAdmin() verifies the CALLER is a signed-in admin using the
 *      user-scoped client (JWT validated with the auth server).
 *   2. Only then do we perform the write with the SERVICE-ROLE client.
 *      RLS is bypassed, but the trigger-based role-escalation guard still
 *      allows service-role connections to change roles.
 *
 * Every action returns a serialisable ActionResult so client components can
 * surface friendly errors (Server Actions must never throw into the UI).
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const ok: ActionResult = { ok: true };
const fail = (message: string): ActionResult => ({ ok: false, message });

/** Verify the caller is an authenticated admin. Returns their user id. */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHENTICATED');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') throw new Error('FORBIDDEN');
  return user.id;
}

/** Wrap an admin operation with friendly error mapping. */
async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    await requireAdmin();
    return await fn();
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('UNAUTHENTICATED')) return fail('Please sign in again.');
    if (raw.includes('FORBIDDEN')) return fail('Admin privileges required.');
    console.error('[admin action]', raw);
    return fail(raw);
  }
}

/* ============================================================================
 * USERS
 * ==========================================================================*/

export interface UserInput {
  id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  role?: 'admin' | 'member';
  membership_status?: 'active' | 'inactive' | 'suspended' | 'pending';
  plan_id?: string | null;
  avatar_url?: string | null;
}

/** Create a user: auth account + profile (role, membership, plan). */
export async function createUserAction(input: UserInput): Promise<ActionResult> {
  return guard(async () => {
    if (!input.email || !input.password) return fail('Email and password are required.');
    if (input.password.length < 8) return fail('Password must be at least 8 characters.');

    const admin = createAdminClient();

    // 1. Create the auth account (email confirmed so they can sign in now).
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name ?? '' },
    });
    if (error) return fail(error.message);

    // 2. The handle_new_user trigger created the profile row — update it
    //    with the admin-assigned role/membership/plan.
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        full_name: input.full_name ?? null,
        role: input.role ?? 'member',
        membership_status: input.membership_status ?? 'active',
        plan_id: input.plan_id ?? null,
        avatar_url: input.avatar_url ?? null,
      })
      .eq('id', data.user.id);
    if (profileError) return fail(profileError.message);

    return ok;
  });
}

/** Update user details / role / membership tier. */
export async function updateUserAction(input: UserInput): Promise<ActionResult> {
  return guard(async () => {
    if (!input.id) return fail('User id is required.');
    if (input.password && input.password.length < 8) {
      return fail('Password must be at least 8 characters.');
    }

    const admin = createAdminClient();

    // Profile fields (service role bypasses the escalation trigger, so
    // admins may change roles here — verified in requireAdmin()).
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        ...(input.full_name !== undefined ? { full_name: input.full_name || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.membership_status !== undefined
          ? { membership_status: input.membership_status }
          : {}),
        ...(input.plan_id !== undefined ? { plan_id: input.plan_id || null } : {}),
        ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url || null } : {}),
      })
      .eq('id', input.id);
    if (profileError) return fail(profileError.message);

    // Optional password reset.
    if (input.password) {
      const { error: pwError } = await admin.auth.admin.updateUserById(input.id, {
        password: input.password,
      });
      if (pwError) return fail(pwError.message);
    }

    return ok;
  });
}

/** Suspend / reactivate an account (soft action on membership_status). */
export async function setUserStatusAction(
  id: string,
  status: 'active' | 'inactive' | 'suspended' | 'pending',
): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const { error } = await admin
      .from('profiles')
      .update({ membership_status: status })
      .eq('id', id);
    if (error) return fail(error.message);
    return ok;
  });
}

/** Permanently delete a user (cascades profile + bookings). */
export async function deleteUserAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return fail(error.message);
    return ok;
  });
}

/* ============================================================================
 * CLASSES
 * ==========================================================================*/

export interface ClassInput {
  id?: string;
  title: string;
  description?: string;
  trainer_name?: string;
  schedule_time: string; // ISO timestamp (datetime-local value)
  capacity: number;
  category: string;
  image_url?: string | null;
}

/** Create or update a gym class. */
export async function upsertClassAction(input: ClassInput): Promise<ActionResult> {
  return guard(async () => {
    if (!input.title.trim()) return fail('Class title is required.');
    if (!input.schedule_time) return fail('Schedule time is required.');
    if (!Number.isFinite(input.capacity) || input.capacity < 1) {
      return fail('Capacity must be at least 1.');
    }

    const admin = createAdminClient();
    const payload = {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      trainer_name: input.trainer_name?.trim() || null,
      schedule_time: new Date(input.schedule_time).toISOString(),
      capacity: Math.round(input.capacity),
      category: input.category || 'Strength',
      image_url: input.image_url?.trim() || null,
    };

    const { error } = input.id
      ? await admin.from('classes').update(payload).eq('id', input.id)
      : await admin.from('classes').insert(payload);

    if (error) return fail(error.message);
    return ok;
  });
}

/** Delete a gym class (bookings cascade). */
export async function deleteClassAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from('classes').delete().eq('id', id);
    if (error) return fail(error.message);
    return ok;
  });
}

/* ============================================================================
 * PLANS (memberships)
 * ==========================================================================*/

export interface PlanInput {
  id?: string;
  name: string;
  price: number;
  billing_cycle: 'monthly' | 'annual';
  features: string[];
  is_active: boolean;
  sort_order: number;
}

/** Create or update a membership plan. */
export async function upsertPlanAction(input: PlanInput): Promise<ActionResult> {
  return guard(async () => {
    if (!input.name.trim()) return fail('Plan name is required.');
    if (!Number.isFinite(input.price) || input.price < 0) return fail('Price must be 0 or more.');

    const admin = createAdminClient();
    const payload = {
      name: input.name.trim(),
      price: input.price,
      billing_cycle: input.billing_cycle,
      features: input.features.filter((f) => f.trim()),
      is_active: input.is_active,
      sort_order: input.sort_order,
    };

    const { error } = input.id
      ? await admin.from('plans').update(payload).eq('id', input.id)
      : await admin.from('plans').insert(payload);

    if (error) return fail(error.message);
    return ok;
  });
}

/** Delete a membership plan. */
export async function deletePlanAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from('plans').delete().eq('id', id);
    if (error) return fail(error.message);
    return ok;
  });
}

/* ============================================================================
 * ANNOUNCEMENTS
 * ==========================================================================*/

export interface AnnouncementInput {
  id?: string;
  title: string;
  body?: string;
  is_active: boolean;
}

/** Create or update an announcement. */
export async function upsertAnnouncementAction(
  input: AnnouncementInput,
): Promise<ActionResult> {
  return guard(async () => {
    if (!input.title.trim()) return fail('Announcement title is required.');

    const admin = createAdminClient();
    const payload = {
      title: input.title.trim(),
      body: input.body?.trim() || null,
      is_active: input.is_active,
    };

    const { error } = input.id
      ? await admin.from('announcements').update(payload).eq('id', input.id)
      : await admin.from('announcements').insert(payload);

    if (error) return fail(error.message);
    return ok;
  });
}

/** Delete an announcement. */
export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from('announcements').delete().eq('id', id);
    if (error) return fail(error.message);
    return ok;
  });
}

/* ============================================================================
 * SITE CONTENT (landing page copy)
 * ==========================================================================*/

/** Update landing-page copy (key/value pairs). */
export async function updateSiteContentAction(
  entries: Record<string, string>,
): Promise<ActionResult> {
  return guard(async () => {
    const admin = createAdminClient();
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value }));

    const { error } = await admin.from('site_content').upsert(rows, { onConflict: 'key' });
    if (error) return fail(error.message);
    return ok;
  });
}
