'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, MailCheck, MailX, Plus, Search, ShieldCheck, UserRound } from 'lucide-react';
import {
  useAdminEmailStatus,
  useAdminMutation,
  useAdminPlans,
  useAdminUsers,
} from '@/lib/hooks/use-admin-data';
import {
  createUserAction,
  deleteUserAction,
  setUserStatusAction,
  updateUserAction,
  verifyUserEmailAction,
} from '@/app/actions/admin';
import { cn, errorMessage, formatFullDateTime, initials } from '@/lib/utils';
import type { AdminUserRow, MembershipStatus, UserRole } from '@/lib/types';
import { Badge, DangerButton, ErrorBanner, Field, Modal } from './shared';
import { ImageUpload } from '@/components/ui/image-upload';

/**
 * User Management — table view of all users.
 * Admin can: add users manually, edit details, change roles/membership
 * tiers, suspend/reactivate and delete accounts.
 */

/** Form state for the add/edit modal. */
interface UserFormState {
  id?: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  membership_status: MembershipStatus;
  plan_id: string;
  avatar_url: string;
}

const EMPTY_FORM: UserFormState = {
  email: '',
  password: '',
  full_name: '',
  role: 'member',
  membership_status: 'active',
  plan_id: '',
  avatar_url: '',
};

export function UserManager() {
  const usersQuery = useAdminUsers();
  const createUser = useAdminMutation(createUserAction);
  const updateUser = useAdminMutation(updateUserAction);
  const setStatus = useAdminMutation(setUserStatusAction);
  const deleteUser = useAdminMutation(deleteUserAction);
  const verifyEmail = useAdminMutation(verifyUserEmailAction);

  const userIds = useMemo(() => (usersQuery.data ?? []).map((u) => u.id), [usersQuery.data]);
  const emailStatus = useAdminEmailStatus(userIds);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return usersQuery.data ?? [];
    return (usersQuery.data ?? []).filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role.includes(q),
    );
  }, [usersQuery.data, search]);

  const busy = createUser.isPending || updateUser.isPending;

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(u: AdminUserRow) {
    setForm({
      id: u.id,
      email: u.email ?? '',
      password: '', // blank = keep existing password
      full_name: u.full_name ?? '',
      role: u.role,
      membership_status: u.membership_status,
      plan_id: (u as AdminUserRow & { plan_id?: string | null }).plan_id ?? '',
      avatar_url: u.avatar_url ?? '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      id: form.id,
      email: form.email.trim() || undefined,
      password: form.password || undefined,
      full_name: form.full_name.trim(),
      role: form.role,
      membership_status: form.membership_status,
      plan_id: form.plan_id || null,
      avatar_url: form.avatar_url.trim() || null,
    };
    try {
      if (form.id) await updateUser.mutateAsync([payload]);
      else await createUser.mutateAsync([payload]);
      setModalOpen(false);
    } catch {
      // Error is surfaced by the banner inside the modal (mutation.error).
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + search + add */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-bone">USER MANAGEMENT</h1>
          <p className="mt-1 text-sm text-white/50">
            {(usersQuery.data ?? []).length} accounts · add, edit, suspend or delete members
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
              className="input w-52 pl-9"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="btn-ember inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            Add user
          </button>
        </div>
      </div>

      {(() => {
        const firstError =
          createUser.error ??
          updateUser.error ??
          setStatus.error ??
          deleteUser.error ??
          verifyEmail.error;
        return <ErrorBanner message={firstError ? errorMessage(firstError) : null} />;
      })()}

      {/* Table (desktop) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading users…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                  <th className="px-5 py-4 font-semibold">User</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Role</th>
                  <th className="px-5 py-4 font-semibold">Membership</th>
                  <th className="px-5 py-4 font-semibold">Plan</th>
                  <th className="px-5 py-4 font-semibold">Bookings</th>
                  <th className="px-5 py-4 font-semibold">Joined</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-white/40">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const userId = u.id;
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={u.avatar_url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-9 w-9 rounded-full border border-white/15 object-cover"
                              />
                            ) : (
                              <span className="avatar h-9 w-9 rounded-full bg-gold text-sm">
                                {initials(u.full_name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-bone">
                                {u.full_name || 'Unnamed'}
                              </div>
                              <div className="truncate text-xs text-white/40">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(() => {
                            const status = emailStatus.data?.[u.id];
                            if (emailStatus.isLoading || !status) {
                              return <span className="text-xs text-white/30">…</span>;
                            }
                            if (status.emailConfirmed) {
                              return (
                                <Badge tone="success">
                                  <MailCheck className="h-3 w-3" strokeWidth={2.5} />
                                  Verified
                                </Badge>
                              );
                            }
                            return (
                              <span className="flex items-center gap-2">
                                <Badge tone="warning">
                                  <MailX className="h-3 w-3" strokeWidth={2.5} />
                                  Unverified
                                </Badge>
                                <button
                                  type="button"
                                  disabled={verifyEmail.isPending}
                                  onClick={() =>
                                    void verifyEmail.mutateAsync([u.id]).catch(() => {})
                                  }
                                  className="rounded-lg border border-gold/40 px-2.5 py-1 text-xs font-semibold text-gold transition-all hover:border-gold hover:bg-gold/10 disabled:opacity-40"
                                >
                                  {verifyEmail.isPending ? 'Verifying…' : 'Verify'}
                                </button>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={u.role === 'admin' ? 'warning' : 'neutral'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            tone={
                              u.membership_status === 'active'
                                ? 'success'
                                : u.membership_status === 'suspended'
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {u.membership_status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-white/60">{u.plan_name ?? '—'}</td>
                        <td className="px-5 py-4 text-white/60">{u.booking_count ?? 0}</td>
                        <td className="px-5 py-4 text-white/50">
                          {formatFullDateTime(u.join_date).split(' · ')[0]}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:border-ember/50 hover:text-ember"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={setStatus.isPending}
                              onClick={() =>
                                void setStatus
                                  .mutateAsync([
                                    userId,
                                    u.membership_status === 'suspended' ? 'active' : 'suspended',
                                  ])
                                  .catch(() => {})
                              }
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:border-gold/50 hover:text-gold disabled:opacity-40"
                            >
                              {u.membership_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                            <DangerButton
                              confirmMessage={`Delete ${u.full_name ?? 'this user'} permanently? This removes their account, bookings and history.`}
                              onConfirm={() => void deleteUser.mutateAsync([userId])}
                              disabled={deleteUser.isPending}
                            >
                              Delete
                            </DangerButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ---------- Add / Edit modal ---------- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'EDIT USER' : 'ADD USER'}
        wide
      >
        <ErrorBanner message={errorMessage(createUser.error ?? updateUser.error)} />

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Alex Carter"
              className="input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              disabled={Boolean(form.id)}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="alex@example.com"
              className="input disabled:opacity-50"
            />
          </Field>
          <Field label={form.id ? 'New password (blank = keep)' : 'Password'}>
            <input
              type="password"
              required={!form.id}
              minLength={form.password ? 8 : undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.id ? '••••••••' : 'At least 8 characters'}
              className="input"
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="input"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Membership status">
            <select
              value={form.membership_status}
              onChange={(e) =>
                setForm({ ...form, membership_status: e.target.value as MembershipStatus })
              }
              className="input"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
          <Field label="Membership tier (plan)">
            <PlanSelect
              value={form.plan_id}
              onChange={(v) => setForm({ ...form, plan_id: v })}
            />
          </Field>
          <div className="sm:col-span-2">
            <ImageUpload
              value={form.avatar_url}
              onChange={(url) => setForm({ ...form, avatar_url: url })}
              bucket="avatars"
              label="User Avatar (Supabase Storage)"
              placeholder="Upload avatar photo or drag & drop (JPG, PNG, WebP)"
              aspectRatio="square"
            />
          </div>

          <div className="flex justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline rounded-lg px-5 py-2.5 text-sm font-semibold text-bone"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={cn(
                'btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800',
              )}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Legend */}
      <p className="flex items-center gap-2 text-xs text-white/35">
        <ShieldCheck className="h-3.5 w-3.5" />
        Role changes and deletions require admin privileges and are enforced server-side.
        <UserRound className="ml-2 h-3.5 w-3.5" />
        Deleting a user cascades to their bookings.
        <MailCheck className="ml-2 h-3.5 w-3.5" />
        Verifying an email marks the auth account as confirmed so the user can sign in.
      </p>
    </div>
  );
}

/** Plan dropdown — fetches plans once for the modal. */
function PlanSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const plansQuery = useAdminPlans();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      <option value="">No plan</option>
      {(plansQuery.data ?? [])
        .filter((p) => p.is_active)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.billing_cycle})
          </option>
        ))}
    </select>
  );
}
