import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import { isThemeKey, type ThemeSnapshot } from '@/lib/themes';

/** One public config row; never cache a previous administrator's selection. */
export async function getGlobalTheme(): Promise<ThemeSnapshot> {
  noStore();
  const { data, error } = await createPublicClient()
    .from('global_theme')
    .select('theme_key,version,updated_at')
    .eq('id', 1)
    .single();
  if (error || !data || !isThemeKey(data.theme_key)) {
    throw new Error('The global theme could not be loaded.');
  }
  return { theme: data.theme_key, version: data.version, updatedAt: data.updated_at };
}
