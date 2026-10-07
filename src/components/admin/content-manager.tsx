'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Megaphone, Plus, Save, Trash2 } from 'lucide-react';
import {
  useAdminAmenities,
  useAdminAnnouncements,
  useAdminMutation,
  useAdminPlans,
  useAdminSiteContent,
} from '@/lib/hooks/use-admin-data';
import {
  deleteAmenityAction,
  deleteAnnouncementAction,
  deletePlanAction,
  upsertAmenityAction,
  upsertAnnouncementAction,
  upsertPlanAction,
  updateSiteContentAction,
} from '@/app/actions/admin';
import { cn, errorMessage, formatPrice } from '@/lib/utils';
import type {
  Amenity,
  AmenityIcon,
  AmenityLayout,
  Announcement,
  BillingCycle,
  Plan,
} from '@/lib/types';
import { Badge, DangerButton, ErrorBanner, Field, Modal, SuccessBanner } from './shared';
import { ImageUpload } from '@/components/ui/image-upload';

/**
 * Content Management — update landing-page text, amenities, membership plans
 * and gym announcements directly from the dashboard. All writes go through the
 * guarded Server Actions.
 */

/* ============================================================================
 * Landing page copy editor
 * ==========================================================================*/

const COPY_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'hero_headline', label: 'Hero headline' },
  { key: 'hero_subhead', label: 'Hero subheadline', multiline: true },
  { key: 'hero_cta', label: 'Hero CTA button text' },
  { key: 'features_title', label: 'Amenities title' },
  { key: 'features_subhead', label: 'Amenities subheadline', multiline: true },
  { key: 'pricing_title', label: 'Pricing title' },
  { key: 'pricing_subhead', label: 'Pricing subheadline', multiline: true },
];

function SiteCopyEditor() {
  const contentQuery = useAdminSiteContent();
  const saveContent = useAdminMutation(updateSiteContentAction);

  const [draft, setDraft] = useState<Record<string, string>>({});

  // Seed the draft with server content once loaded.
  useEffect(() => {
    if (contentQuery.data) setDraft(contentQuery.data);
  }, [contentQuery.data]);

  async function handleSave() {
    try {
      await saveContent.mutateAsync([draft]);
    } catch {
      // surfaced via banner
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-3xl tracking-wide text-bone">LANDING PAGE COPY</h2>
        <p className="mt-1 text-sm text-white/50">
          Update the hero, amenities and pricing text shown on the public site.
        </p>
      </div>

      <ErrorBanner message={errorMessage(saveContent.error)} />
      <SuccessBanner message={saveContent.isSuccess ? 'Landing page copy updated.' : null} />

      <div className="glass-card p-6 sm:p-8">
        {contentQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {COPY_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} className={f.multiline ? 'md:col-span-2' : ''}>
                {f.multiline ? (
                  <textarea
                    rows={2}
                    value={draft[f.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="input resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={draft[f.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="input"
                  />
                )}
              </Field>
            ))}
            <div className="md:col-span-2 border-t border-white/10 pt-4">
              <ImageUpload
                value={draft['hero_image_url'] ?? ''}
                onChange={(url) => setDraft({ ...draft, hero_image_url: url })}
                bucket="site-assets"
                label="Landing Hero Background Image (Supabase Storage)"
                placeholder="Upload hero background photo or drag & drop (JPG, PNG, WebP)"
                aspectRatio="banner"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveContent.isPending}
          className="btn-ember mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-ink-800"
        >
          {saveContent.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save copy
        </button>
      </div>
    </section>
  );
}

/* ============================================================================
 * Announcements editor
 * ==========================================================================*/

function AnnouncementsEditor() {
  const announcementsQuery = useAdminAnnouncements();
  const upsert = useAdminMutation(upsertAnnouncementAction);
  const remove = useAdminMutation(deleteAnnouncementAction);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ id?: string; title: string; body: string; is_active: boolean }>(
    { title: '', body: '', is_active: true },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsert.mutateAsync([form]);
      setModalOpen(false);
    } catch {
      // surfaced via banner
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-bone">ANNOUNCEMENTS</h2>
          <p className="mt-1 text-sm text-white/50">
            Shown in the marquee on the public landing page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ title: '', body: '', is_active: true });
            setModalOpen(true);
          }}
          className="btn-ember inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          New
        </button>
      </div>

      <ErrorBanner message={errorMessage(upsert.error ?? remove.error)} />

      <ul className="space-y-3">
        {announcementsQuery.isLoading ? (
          <li className="glass-card flex items-center justify-center gap-3 py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </li>
        ) : (announcementsQuery.data ?? []).length === 0 ? (
          <li className="glass-card p-10 text-center text-sm text-white/40">
            No announcements yet.
          </li>
        ) : (
          (announcementsQuery.data ?? []).map((a: Announcement) => (
            <li key={a.id} className="glass-card flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <Megaphone className="h-4 w-4 flex-none text-ember" />
                  <h3 className="truncate font-semibold text-bone">{a.title}</h3>
                  <Badge tone={a.is_active ? 'success' : 'neutral'}>
                    {a.is_active ? 'Live' : 'Hidden'}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm text-white/50">{a.body}</p>
              </div>
              <div className="flex flex-none gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ id: a.id, title: a.title, body: a.body ?? '', is_active: a.is_active });
                    setModalOpen(true);
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:border-ember/50 hover:text-ember"
                >
                  Edit
                </button>
                <DangerButton
                  confirmMessage={`Delete announcement "${a.title}"?`}
                  onConfirm={() => void remove.mutateAsync([a.id])}
                  disabled={remove.isPending}
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </span>
                </DangerButton>
              </div>
            </li>
          ))
        )}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'EDIT ANNOUNCEMENT' : 'NEW ANNOUNCEMENT'}
      >
        <ErrorBanner message={errorMessage(upsert.error)} />
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Title">
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="New cold plunge installed"
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Details shown next to the title…"
              className="input resize-none"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[#FF5A1F]"
            />
            Live (visible on the landing page)
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline rounded-lg px-5 py-2.5 text-sm font-semibold text-bone"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className="btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800"
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Save' : 'Publish'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ============================================================================
 * Amenities editor
 * ==========================================================================*/

interface AmenityForm {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  icon_name: AmenityIcon;
  layout: AmenityLayout;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_AMENITY: AmenityForm = {
  title: '',
  description: '',
  image_url: '',
  icon_name: 'dumbbell',
  layout: 'standard',
  is_active: true,
  sort_order: '0',
};

function AmenitiesEditor() {
  const amenitiesQuery = useAdminAmenities();
  const upsert = useAdminMutation(upsertAmenityAction);
  const remove = useAdminMutation(deleteAmenityAction);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AmenityForm>(EMPTY_AMENITY);

  function openCreate() {
    setForm({ ...EMPTY_AMENITY, sort_order: String((amenitiesQuery.data ?? []).length) });
    setModalOpen(true);
  }

  function openEdit(amenity: Amenity) {
    setForm({
      id: amenity.id,
      title: amenity.title,
      description: amenity.description ?? '',
      image_url: amenity.image_url ?? '',
      icon_name: amenity.icon_name,
      layout: amenity.layout,
      is_active: amenity.is_active,
      sort_order: String(amenity.sort_order),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsert.mutateAsync([
        {
          ...form,
          image_url: form.image_url || null,
          sort_order: Number(form.sort_order),
        },
      ]);
      setModalOpen(false);
    } catch {
      // surfaced via banner
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-bone">AMENITIES</h2>
          <p className="mt-1 text-sm text-white/50">
            Manage the image cards shown in the landing-page amenities grid.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-ember inline-flex flex-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          New amenity
        </button>
      </div>

      <ErrorBanner message={errorMessage(upsert.error ?? remove.error ?? amenitiesQuery.error)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {amenitiesQuery.isLoading ? (
          <div className="glass-card col-span-full flex items-center justify-center gap-3 py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (amenitiesQuery.data ?? []).length === 0 ? (
          <div className="glass-card col-span-full p-10 text-center text-sm text-white/40">
            No amenities yet.
          </div>
        ) : (
          (amenitiesQuery.data ?? []).map((amenity) => (
            <article key={amenity.id} className="glass-card overflow-hidden">
              <div className="aspect-video bg-ink-900">
                {amenity.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={amenity.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/30">
                    No image
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-bone">{amenity.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-white/50">
                      {amenity.description}
                    </p>
                  </div>
                  <Badge tone={amenity.is_active ? 'success' : 'neutral'}>
                    {amenity.is_active ? 'Live' : 'Hidden'}
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2 text-[11px] uppercase tracking-wide text-white/35">
                  <span>{amenity.layout}</span>
                  <span>·</span>
                  <span>Order {amenity.sort_order}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(amenity)}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/70 transition-all hover:border-ember/50 hover:text-ember"
                  >
                    Edit
                  </button>
                  <DangerButton
                    confirmMessage={`Delete amenity "${amenity.title}"?`}
                    onConfirm={() => void remove.mutateAsync([amenity.id])}
                    disabled={remove.isPending}
                  >
                    <span className="flex items-center gap-1.5">
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </span>
                  </DangerButton>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'EDIT AMENITY' : 'NEW AMENITY'}
      >
        <ErrorBanner message={errorMessage(upsert.error)} />
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Title">
            <input
              type="text"
              required
              maxLength={100}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Elite Strength Floor"
              className="input"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What members can expect…"
              className="input resize-none"
            />
          </Field>
          <ImageUpload
            value={form.image_url}
            onChange={(image_url) => setForm({ ...form, image_url })}
            bucket="site-assets"
            label="Card image"
            aspectRatio="video"
            placeholder="Upload a landscape gym photo (JPG, PNG or WebP)"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Icon">
              <select
                value={form.icon_name}
                onChange={(e) => setForm({ ...form, icon_name: e.target.value as AmenityIcon })}
                className="input"
              >
                <option value="dumbbell">Dumbbell</option>
                <option value="flame">Flame</option>
                <option value="waves">Waves</option>
                <option value="clipboard">Clipboard</option>
                <option value="users">Community</option>
                <option value="heart">Heart</option>
              </select>
            </Field>
            <Field label="Card size">
              <select
                value={form.layout}
                onChange={(e) => setForm({ ...form, layout: e.target.value as AmenityLayout })}
                className="input"
              >
                <option value="standard">Standard</option>
                <option value="wide">Wide</option>
                <option value="large">Large</option>
              </select>
            </Field>
            <Field label="Order">
              <input
                type="number"
                required
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[#FF5A1F]"
            />
            Live (visible on the landing page)
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline rounded-lg px-5 py-2.5 text-sm font-semibold text-bone"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className="btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800"
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Save changes' : 'Create amenity'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ============================================================================
 * Plans editor
 * ==========================================================================*/

function PlansEditor() {
  const plansQuery = useAdminPlans();
  const upsert = useAdminMutation(upsertPlanAction);
  const remove = useAdminMutation(deletePlanAction);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    price: string;
    billing_cycle: BillingCycle;
    featuresText: string;
    is_active: boolean;
  }>({ name: '', price: '', billing_cycle: 'monthly', featuresText: '', is_active: true });

  function openCreate() {
    setForm({ name: '', price: '', billing_cycle: 'monthly', featuresText: '', is_active: true });
    setModalOpen(true);
  }

  function openEdit(p: Plan) {
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      billing_cycle: p.billing_cycle,
      featuresText: (Array.isArray(p.features) ? (p.features as string[]) : []).join('\n'),
      is_active: p.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsert.mutateAsync([
        {
          id: form.id,
          name: form.name,
          price: Number(form.price),
          billing_cycle: form.billing_cycle,
          features: form.featuresText.split('\n'),
          is_active: form.is_active,
          sort_order: form.id
            ? (plansQuery.data ?? []).find((p) => p.id === form.id)?.sort_order ?? 0
            : (plansQuery.data ?? []).length,
        },
      ]);
      setModalOpen(false);
    } catch {
      // surfaced via banner
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-bone">MEMBERSHIP PLANS</h2>
          <p className="mt-1 text-sm text-white/50">
            Pricing cards on the public site + tier assignment for users.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn-ember inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          New plan
        </button>
      </div>

      <ErrorBanner message={errorMessage(upsert.error ?? remove.error)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plansQuery.isLoading ? (
          <div className="glass-card col-span-full flex items-center justify-center gap-3 py-10 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          (plansQuery.data ?? []).map((p) => (
            <div key={p.id} className="glass-card card-lift flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl tracking-wide text-bone">{p.name}</h3>
                <Badge tone={p.is_active ? 'success' : 'neutral'}>
                  {p.is_active ? 'Active' : 'Hidden'}
                </Badge>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-4xl text-ember">{formatPrice(p.price)}</span>
                <span className="text-xs text-white/40">/{p.billing_cycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-white/60">
                {(Array.isArray(p.features) ? (p.features as string[]) : []).map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-ember">·</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/70 transition-all hover:border-ember/50 hover:text-ember"
                >
                  Edit
                </button>
                <DangerButton
                  confirmMessage={`Delete plan "${p.name}"? Users assigned to it will keep their accounts but lose the tier.`}
                  onConfirm={() => void remove.mutateAsync([p.id])}
                  disabled={remove.isPending}
                >
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </span>
                </DangerButton>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'EDIT PLAN' : 'NEW PLAN'}
      >
        <ErrorBanner message={errorMessage(upsert.error)} />
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Name">
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Forge Elite"
                className="input"
              />
            </Field>
            <Field label="Price (NPR)">
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="4000"
                className="input"
              />
            </Field>
          </div>
          <Field label="Billing cycle">
            <select
              value={form.billing_cycle}
              onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as BillingCycle })}
              className="input"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Features (one per line)">
            <textarea
              rows={4}
              value={form.featuresText}
              onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              placeholder={'Unlimited group classes\nSauna + cold plunge'}
              className="input resize-none"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-bone">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[#FF5A1F]"
            />
            Active (visible on the pricing page)
          </label>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline rounded-lg px-5 py-2.5 text-sm font-semibold text-bone"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className={cn(
                'btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800',
              )}
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.id ? 'Save' : 'Create plan'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ============================================================================
 * Page wrapper
 * ==========================================================================*/

export function ContentManager() {
  return (
    <div className="space-y-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-4xl tracking-wide text-bone">CONTENT MANAGEMENT</h1>
        <p className="mt-1 text-sm text-white/50">
          Landing page copy, pricing plans and gym announcements — changes go live instantly.
        </p>
      </motion.div>

      <SiteCopyEditor />
      <AmenitiesEditor />
      <AnnouncementsEditor />
      <PlansEditor />
    </div>
  );
}
