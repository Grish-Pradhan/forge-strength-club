'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/types';

/**
 * Auth context — wraps the whole app.
 *
 * Holds the Supabase session + the user's profile (with `role`) and exposes
 * helpers for sign-in flows. Route protection itself is enforced twice:
 *   1. src/middleware.ts  (server-side redirects — the real gate)
 *   2. this context       (client-side UX + role for conditional UI)
 */

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  /** Re-read the profile row (e.g. after membership changes). */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Sign in with email/password. Returns an error message or null. */
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  /** Email/password signup (profile is auto-created by DB trigger). */
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<string | null>;
  /** OAuth (Google / Apple) sign-in — redirects to the provider. */
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
    [supabase],
  );

  // Load session once, then keep it in sync with Supabase auth events.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        if (s?.user) void fetchProfile(s.user.id);
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) void fetchProfile(s.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Full reload so server components re-render for the anonymous state.
    window.location.href = '/';
  }, [supabase]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      return null;
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName: string): Promise<string | null> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) return error.message;
      return null;
    },
    [supabase],
  );

  const signInWithOAuth = useCallback(
    async (provider: 'google' | 'apple') => {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    },
    [supabase],
  );

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    refreshProfile,
    signOut,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws when used outside <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
