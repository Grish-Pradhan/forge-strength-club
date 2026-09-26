'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { BrandMark } from '@/components/logo';

/**
 * Sign-in page — email/password + OAuth (Google / Apple).
 * Redirects to the `?next=` target or the dashboard on success.
 * The `next` param is read from window.location (only used in the submit
 * handler) so the form server-renders without a Suspense fallback.
 */
function LoginForm() {
  const { signInWithPassword, signInWithOAuth } = useAuth();
  const [nextPath] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next') || '/dashboard'
      : '/dashboard',
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err = await signInWithPassword(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    // Full navigation so middleware re-evaluates the role and routes
    // members to /dashboard and admins to /admin.
    window.location.href = nextPath;
  }

  return (
    <div className="grain-bg flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-bone"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </Link>

        <div className="glass-card p-8">
          {/* Logo */}
          <div className="mb-8">
            <BrandMark markClassName="h-10 w-auto" />
          </div>

          <h1 className="font-display text-4xl text-bone">WELCOME BACK</h1>
          <p className="mt-2 text-sm text-white/50">Sign in to book classes and track your training.</p>

          {/* OAuth */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void signInWithOAuth('google')}
              className="btn-outline flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-bone"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 3.95-.8 5.29-2.65l-3.57-2.77c-.98.6-2.23.96-3.72.96-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="currentColor"
                  d="M4.84 14.01a6.6 6.6 0 0 1 0-4.02V7.15H2.18a11 11 0 0 0 0 9.7l2.66-2.84Z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 5.42.62 5.42.62l3.15-3.15A11 11 0 0 0 2.18 7.15l2.66 2.84C5.71 6.39 8.14 5.38 12 5.38Z"
                />
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => void signInWithOAuth('apple')}
              className="btn-outline flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-bone"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.47-2.2.32-3.06-.35C2.44 15.7 3.18 7.6 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
              </svg>
              Apple
            </button>
          </div>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-white/35">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="btn-ember w-full rounded-lg py-3 text-sm font-bold text-ink-800"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/50">
            New to Forge?{' '}
            <Link href="/register" className="font-semibold text-ember hover:underline">
              Join now
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
