/** Shared allowlist. No user CSS or arbitrary theme keys are accepted. */
export const THEMES = [
  { key: 'default', name: 'Default Gym', description: 'Modern iron, fitness crimson and warm gold.', badge: 'The everyday original' },
  { key: 'dashain', name: 'Dashain', description: 'Marigold orange, traditional crimson and auspicious gold.', badge: 'Strength & blessings' },
  { key: 'tihar', name: 'Tihar', description: 'An indigo night sky with golden lights and marigold.', badge: 'Festival of lights' },
  { key: 'christmas', name: 'Christmas', description: 'Deep forest green with rich festive red and gold.', badge: 'A season to celebrate' },
  { key: 'new-year', name: 'New Year', description: 'Midnight blue with electric mint and celebratory gold.', badge: 'A fresh start' },
] as const;

export type ThemeKey = (typeof THEMES)[number]['key'];
export interface ThemeSnapshot {
  theme: ThemeKey;
  version: number;
  updatedAt: string | null;
}

export const DEFAULT_THEME: ThemeSnapshot = { theme: 'default', version: 0, updatedAt: null };

export function isThemeKey(value: unknown): value is ThemeKey {
  return THEMES.some((theme) => theme.key === value);
}

export function isThemeSnapshot(value: unknown): value is ThemeSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return isThemeKey(row.theme) && Number.isSafeInteger(row.version) && Number(row.version) >= 0 &&
    (row.updatedAt === null || typeof row.updatedAt === 'string');
}
