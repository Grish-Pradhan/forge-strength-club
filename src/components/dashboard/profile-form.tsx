'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';
import { cn, errorMessage, initials } from '@/lib/utils';
import { ImageUpload } from '@/components/ui/image-upload';
import { PlanCheckout } from '@/components/dashboard/plan-checkout';

/**
 * Profile & Settings — manage personal info (name, avatar URL) and view
 * membership/billing details. Updates run through the RLS-protected
 * `profiles_update_own` policy (members can never change their own role —
 * the prevent_role_escalation trigger blocks that server-side).
 */
export function ProfileForm() {
  const { profile, refreshProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The auth context loads the profile ASYNC — on first render `profile` is
  // null, so the form state must re-sync once it arrives (otherwise the name
  // field renders empty and saving would wipe the stored name). Keyed on the
  // profile id: re-fetches after a save don't clobber in-progress edits.
  const profileId = profile?.id;
  useEffect(() => {
    if (profileId) {
      setFullName(profile?.full_name ?? '');
      setAvatarUrl(profile?.avatar_url ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    if (!profile) {
      setError('Profile not loaded — please refresh the page.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await createClient()
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError));
      return;
    }
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-8">
      {/* ---------- Personal info ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="font-display mb-4 text-3xl tracking-wide text-bone">PERSONAL INFO</h2>
        <div className="glass-card p-6 sm:p-8">
          {/* Avatar preview */}
          <div className="mb-6 flex items-center gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar preview"
                className="h-16 w-16 rounded-2xl border border-white/15 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="avatar h-16 w-16 rounded-2xl bg-gold text-2xl">
                {initials(fullName)}
              </span>
            )}
            <div>
              <div className="font-semibold text-bone">{fullName || 'Your name'}</div>
              <div className="text-sm text-white/50">{profile?.email}</div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              {error}
            </div>
          )}
          {saved && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
              Profile updated.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className="label">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Carter"
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <ImageUpload
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  bucket="avatars"
                  label="Profile Picture (Supabase Storage)"
                  placeholder="Click to upload profile photo or drag & drop (JPG, PNG, WebP)"
                  aspectRatio="square"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={saving}
                className="btn-ember inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-ink-800"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </motion.section>

      {/* ---------- Membership / billing ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="font-display mb-4 text-3xl tracking-wide text-bone">
          MEMBERSHIP & <span className="text-ember">BILLING</span>
        </h2>
        <div className="glass-card p-6 sm:p-8">
          <PlanCheckout />
        </div>
      </motion.section>

      {/* ---------- Danger zone ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="font-display mb-4 text-3xl tracking-wide text-bone">ACCOUNT</h2>
        <div className="glass-card border-red-500/20 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold text-bone">Sign out of this device</h3>
              <p className="mt-1 text-sm text-white/50">
                You'll need to sign in again to book classes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-5 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
