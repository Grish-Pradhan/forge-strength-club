import { createPublicClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  FALLBACK_ANNOUNCEMENTS,
  FALLBACK_CLASSES,
  FALLBACK_PLANS,
  FALLBACK_SITE_CONTENT,
} from '@/lib/fallback-data';
import type { Announcement, ClassWithCount, Plan } from '@/lib/types';

/**
 * Public data service — used by Server Components on the landing page.
 *
 * Every read degrades gracefully: if Supabase isn't configured (no
 * .env.local) or a query fails, we fall back to the static seed data so
 * the landing page ALWAYS renders.
 */

/** Fetch upcoming classes with their live booked counts. */
export async function getUpcomingClasses(): Promise<{
  classes: ClassWithCount[];
  live: boolean;
}> {
  if (!isSupabaseConfigured()) return { classes: FALLBACK_CLASSES, live: false };

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('classes_public')
      .select('*')
      .gte('schedule_time', new Date().toISOString())
      .order('schedule_time', { ascending: true })
      .limit(12);

    if (error || !data || data.length === 0) {
      if (error) console.error('[public.getUpcomingClasses]', error.message);
      return { classes: FALLBACK_CLASSES, live: false };
    }
    return { classes: data as ClassWithCount[], live: true };
  } catch (err) {
    console.error('[public.getUpcomingClasses]', err);
    return { classes: FALLBACK_CLASSES, live: false };
  }
}

/** Fetch active membership plans, ordered. */
export async function getPlans(): Promise<{ plans: Plan[]; live: boolean }> {
  if (!isSupabaseConfigured()) return { plans: FALLBACK_PLANS, live: false };

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.error('[public.getPlans]', error.message);
      return { plans: FALLBACK_PLANS, live: false };
    }
    return { plans: data as Plan[], live: true };
  } catch (err) {
    console.error('[public.getPlans]', err);
    return { plans: FALLBACK_PLANS, live: false };
  }
}

/** Fetch active announcements (newest first). */
export async function getAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured()) return FALLBACK_ANNOUNCEMENTS;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      if (error) console.error('[public.getAnnouncements]', error.message);
      return FALLBACK_ANNOUNCEMENTS;
    }
    return data as Announcement[];
  } catch (err) {
    console.error('[public.getAnnouncements]', err);
    return FALLBACK_ANNOUNCEMENTS;
  }
}

/** Fetch landing-page copy from the site_content key/value store. */
export async function getSiteContent(): Promise<{
  content: Record<string, string>;
  live: boolean;
}> {
  if (!isSupabaseConfigured()) return { content: FALLBACK_SITE_CONTENT, live: false };

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from('site_content').select('key,value');

    if (error || !data || data.length === 0) {
      if (error) console.error('[public.getSiteContent]', error.message);
      return { content: FALLBACK_SITE_CONTENT, live: false };
    }
    const content = Object.fromEntries(data.map((row) => [row.key, row.value]));
    // Merge over fallbacks so missing keys still render.
    return { content: { ...FALLBACK_SITE_CONTENT, ...content }, live: true };
  } catch (err) {
    console.error('[public.getSiteContent]', err);
    return { content: FALLBACK_SITE_CONTENT, live: false };
  }
}
