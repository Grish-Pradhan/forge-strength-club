'use client';

import { useState } from 'react';
import { Check, Dumbbell, Flower2, Flame, Globe2, Loader2, PartyPopper, TreePine } from 'lucide-react';
import { THEMES, type ThemeKey } from '@/lib/themes';
import { useGlobalTheme } from '@/providers/theme-provider';

const icons = { default: Dumbbell, dashain: Flower2, tihar: Flame, christmas: TreePine, 'new-year': PartyPopper };

export function ThemeSwitcher() {
  const { theme, saving, syncError, changeTheme } = useGlobalTheme();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function selectTheme(key: ThemeKey) {
    setError('');
    setMessage('');
    try {
      await changeTheme(key);
      setMessage(`${THEMES.find((item) => item.key === key)!.name} is now the global theme.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the theme. Please try again.');
    }
  }

  return (
    <section className="glass-card p-5 sm:p-6" aria-labelledby="global-theme-heading" aria-busy={saving}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="global-theme-heading" className="font-display text-2xl tracking-wide text-bone">GLOBAL FESTIVAL THEME</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">
            One selection for your entire club. Changes apply to the landing page, member dashboard and admin dashboard.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
          <Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> Site-wide
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Choose the global website theme">
        {THEMES.map((item) => {
          const Icon = icons[item.key];
          const selected = item.key === theme;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected}
              aria-label={`${item.name} theme`}
              disabled={saving}
              onClick={() => void selectTheme(item.key)}
              className={`group overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-offset-4 disabled:cursor-wait ${selected ? 'border-ember ring-2 ring-ember/40' : 'border-white/15 hover:border-white/40'}`}
            >
              <span data-theme={item.key} className="flex h-full flex-col bg-ink-800 p-4 text-bone">
                <span className="mb-5 flex items-center justify-between">
                  <span className="rounded-xl bg-ember/15 p-2.5 text-ember"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  {selected ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-ember">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      {saving ? 'Saving' : 'Active'}
                    </span>
                  ) : null}
                </span>
                <span className="text-base font-bold">{item.name}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gold">{item.badge}</span>
                <span className="mt-3 flex-1 text-xs leading-relaxed text-bone/70">{item.description}</span>
                <span className="mt-5 flex gap-1.5" aria-hidden="true">
                  <span className="h-2 flex-1 rounded-full bg-ink-600" />
                  <span className="h-2 flex-1 rounded-full bg-ember" />
                  <span className="h-2 flex-1 rounded-full bg-gold" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-5 text-xs" role="status" aria-live="polite" aria-atomic="true">
        {error ? <span className="text-red-300">{error}</span> : saving ? (
          <span className="text-white/60">Saving the global theme…</span>
        ) : syncError ? (
          <span className="text-amber-300">Theme connection interrupted. Keeping the last theme and retrying automatically.</span>
        ) : <span className="text-white/60">{message || 'Choose a theme to publish it immediately. All five themes are available year-round.'}</span>}
      </div>
    </section>
  );
}
