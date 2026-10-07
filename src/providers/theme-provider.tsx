'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { isThemeSnapshot, type ThemeKey, type ThemeSnapshot } from '@/lib/themes';

interface ThemeContextValue {
  theme: ThemeKey;
  saving: boolean;
  syncError: boolean;
  changeTheme: (theme: ThemeKey) => Promise<void>;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initialTheme }: {
  children: React.ReactNode;
  initialTheme: ThemeSnapshot;
}) {
  const [theme, setTheme] = useState(initialTheme.theme);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const confirmed = useRef(initialTheme);
  const pending = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const display = useCallback((key: ThemeKey) => {
    document.documentElement.setAttribute('data-theme', key);
    setTheme(key);
  }, []);

  const accept = useCallback((value: unknown) => {
    if (!isThemeSnapshot(value) || value.version < confirmed.current.version) return;
    confirmed.current = value;
    setSyncError(false);
    if (!pending.current) display(value.theme);
  }, [display]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/theme', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('Theme unavailable');
      const snapshot: unknown = await response.json();
      if (!isThemeSnapshot(snapshot)) throw new Error('Invalid theme');
      if (!signal?.aborted) accept(snapshot);
    } catch {
      if (!signal?.aborted) setSyncError(true);
    }
  }, [accept]);

  useEffect(() => {
    const controller = new AbortController();
    const sync = () => {
      if (document.visibilityState === 'visible') void refresh(controller.signal);
    };
    void refresh(controller.signal);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', sync);
    // Recovery for missed events, sleeping tabs and blocked WebSockets.
    const timer = window.setInterval(sync, 30_000);
    if ('BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel('forge-global-theme');
      // Messages are invalidations only; trust the server for the actual value.
      channelRef.current.onmessage = () => void refresh(controller.signal);
    }

    const supabase = isSupabaseConfigured() ? createClient() : null;
    const subscription = supabase?.channel('forge-global-theme')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'global_theme', filter: 'id=eq.1',
      }, ({ new: row }) => {
        if (!controller.signal.aborted) {
          accept({ theme: row.theme_key, version: row.version, updatedAt: row.updated_at });
        }
      })
      .subscribe((status) => {
        // Close the fetch/subscribe race and recover after reconnecting.
        if (status === 'SUBSCRIBED') void refresh(controller.signal);
      });

    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', sync);
      channelRef.current?.close();
      channelRef.current = null;
      if (supabase && subscription) void supabase.removeChannel(subscription);
    };
  }, [accept, refresh]);

  const changeTheme = useCallback(async (key: ThemeKey) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    display(key);
    let saved = false;
    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: key }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isThemeSnapshot(result)) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error : 'Unable to save the theme. Please try again.';
        throw new Error(message);
      }
      accept(result);
      saved = true;
      channelRef.current?.postMessage('refresh');
    } finally {
      pending.current = false;
      setSaving(false);
      display(confirmed.current.theme);
      // A lost HTTP response may follow a successful commit. Reconcile it.
      if (!saved) void refresh();
    }
  }, [accept, display, refresh]);

  const value = useMemo(() => ({ theme, saving, syncError, changeTheme }), [theme, saving, syncError, changeTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useGlobalTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useGlobalTheme requires ThemeProvider');
  return context;
}
