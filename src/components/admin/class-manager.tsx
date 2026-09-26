'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useAdminClasses, useAdminMutation } from '@/lib/hooks/use-admin-data';
import { deleteClassAction, upsertClassAction } from '@/app/actions/admin';
import { cn, errorMessage, formatFullDateTime } from '@/lib/utils';
import type { ClassWithCount } from '@/lib/types';
import { Badge, DangerButton, ErrorBanner, Field, Modal } from './shared';
import { ImageUpload } from '@/components/ui/image-upload';

/**
 * Class Management — full CRUD for gym classes: create, edit, delete,
 * assign trainers, adjust capacities. Live booked counts are shown so the
 * admin can see fill rates at a glance.
 */

interface ClassFormState {
  id?: string;
  title: string;
  description: string;
  trainer_name: string;
  schedule_time: string; // datetime-local format
  capacity: string;
  category: string;
  image_url: string;
}

const EMPTY_FORM: ClassFormState = {
  title: '',
  description: '',
  trainer_name: '',
  schedule_time: '',
  capacity: '16',
  category: 'Strength',
  image_url: '',
};

const CATEGORIES = ['Strength', 'HIIT', 'CrossFit', 'Boxing', 'Yoga & Mobility'];

/** ISO timestamp -> datetime-local value (for prefilling the edit form). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClassManager() {
  const classesQuery = useAdminClasses();
  const upsertClass = useAdminMutation(upsertClassAction);
  const deleteClass = useAdminMutation(deleteClassAction);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM);

  const sorted = useMemo(
    () =>
      [...(classesQuery.data ?? [])].sort(
        (a, b) => new Date(a.schedule_time).getTime() - new Date(b.schedule_time).getTime(),
      ),
    [classesQuery.data],
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: ClassWithCount) {
    setForm({
      id: c.id,
      title: c.title,
      description: c.description ?? '',
      trainer_name: c.trainer_name ?? '',
      schedule_time: toLocalInput(c.schedule_time),
      capacity: String(c.capacity),
      category: c.category,
      image_url: c.image_url ?? '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertClass.mutateAsync([
        {
          id: form.id,
          title: form.title,
          description: form.description,
          trainer_name: form.trainer_name,
          schedule_time: form.schedule_time,
          capacity: Number(form.capacity),
          category: form.category,
          image_url: form.image_url,
        },
      ]);
      setModalOpen(false);
    } catch {
      // Mutation error is surfaced via the banner inside the modal.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-bone">CLASS MANAGEMENT</h1>
          <p className="mt-1 text-sm text-white/50">
            Create classes, assign trainers, adjust capacity
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-ember inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          New class
        </button>
      </div>

      {(upsertClass.isError || deleteClass.isError) && (
        <ErrorBanner
          message={errorMessage(upsertClass.error ?? deleteClass.error)}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card overflow-hidden"
      >
        {classesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading classes…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                  <th className="px-5 py-4 font-semibold">Class</th>
                  <th className="px-5 py-4 font-semibold">Category</th>
                  <th className="px-5 py-4 font-semibold">Schedule</th>
                  <th className="px-5 py-4 font-semibold">Trainer</th>
                  <th className="px-5 py-4 font-semibold">Capacity</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-white/40">
                      No classes yet — create the first one.
                    </td>
                  </tr>
                ) : (
                  sorted.map((c) => {
                    const fillPct = Math.round((c.booked_count / c.capacity) * 100);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {c.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.image_url}
                                alt={c.title}
                                loading="lazy"
                                decoding="async"
                                className="h-10 w-14 flex-none rounded-lg border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-14 flex-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] text-white/30">
                                No img
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-bone">{c.title}</div>
                              <div className="mt-0.5 line-clamp-1 max-w-xs text-xs text-white/40">
                                {c.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone="ember">{c.category}</Badge>
                        </td>
                        <td className="px-5 py-4 text-white/60">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-ember" />
                            {formatFullDateTime(c.schedule_time)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-white/60">{c.trainer_name ?? '—'}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white/60">
                              {c.booked_count}/{c.capacity}
                            </span>
                            {/* Fill-rate bar */}
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  fillPct >= 100
                                    ? 'bg-red-500'
                                    : fillPct >= 80
                                      ? 'bg-ember'
                                      : 'bg-emerald-500',
                                )}
                                style={{ width: `${Math.min(fillPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:border-ember/50 hover:text-ember"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <DangerButton
                              confirmMessage={`Delete "${c.title}" permanently? All its bookings will be removed.`}
                              onConfirm={() => void deleteClass.mutateAsync([c.id])}
                              disabled={deleteClass.isPending}
                            >
                              <span className="flex items-center gap-1.5">
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </span>
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

      <p className="flex items-center gap-2 text-xs text-white/35">
        <Users className="h-3.5 w-3.5" />
        Capacity is enforced atomically by the book_class() RPC — members can never
        overbook a full class.
      </p>

      {/* ---------- Create / Edit modal ---------- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'EDIT CLASS' : 'NEW CLASS'}
        wide
      >
        <ErrorBanner message={errorMessage(upsertClass.error)} />

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Strength Foundations"
              className="input"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What happens in this class?"
              className="input resize-none"
            />
          </Field>
          <Field label="Trainer">
            <input
              type="text"
              value={form.trainer_name}
              onChange={(e) => setForm({ ...form, trainer_name: e.target.value })}
              placeholder="Maya Kowalski"
              className="input"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Schedule time">
            <input
              type="datetime-local"
              required
              value={form.schedule_time}
              onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Capacity">
            <input
              type="number"
              required
              min={1}
              max={200}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className="input"
            />
          </Field>
          <div className="sm:col-span-2">
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              bucket="class-covers"
              label="Cover Image (Supabase Storage)"
              placeholder="Upload class cover photo or drag & drop (JPG, PNG, WebP)"
              aspectRatio="video"
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
              disabled={upsertClass.isPending}
              className="btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800"
            >
              {upsertClass.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Save changes' : 'Create class'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
