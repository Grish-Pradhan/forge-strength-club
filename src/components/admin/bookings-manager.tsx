'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus, Loader2, Search, Trash2 } from 'lucide-react';
import {
  createAdminBookingAction,
  deleteBookingAction,
  updateBookingStatusAction,
} from '@/app/actions/admin';
import {
  useAdminBookings,
  useAdminClasses,
  useAdminMutation,
  useAdminUsers,
} from '@/lib/hooks/use-admin-data';
import type { BookingStatus } from '@/lib/types';
import { errorMessage, formatFullDateTime } from '@/lib/utils';
import { Badge, DangerButton, ErrorBanner, Field, Modal } from './shared';

const STATUS_TONES: Record<BookingStatus, 'success' | 'neutral' | 'ember'> = {
  confirmed: 'success',
  cancelled: 'neutral',
  attended: 'ember',
};

export function AdminBookingsManager() {
  const bookingsQuery = useAdminBookings();
  const usersQuery = useAdminUsers();
  const classesQuery = useAdminClasses();
  const createBooking = useAdminMutation(createAdminBookingAction);
  const updateStatus = useAdminMutation(updateBookingStatusAction);
  const remove = useAdminMutation(deleteBookingAction);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [classId, setClassId] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (bookingsQuery.data ?? []).filter((booking) => {
      const matchesStatus = status === 'all' || booking.booking_status === status;
      const haystack = `${booking.profile?.full_name ?? ''} ${booking.profile?.email ?? ''} ${booking.class?.title ?? ''}`.toLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [bookingsQuery.data, search, status]);

  const upcomingClasses = (classesQuery.data ?? []).filter(
    (gymClass) => new Date(gymClass.schedule_time) > new Date(),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createBooking.mutateAsync([userId, classId]);
      setModalOpen(false);
      setUserId('');
      setClassId('');
    } catch {
      // surfaced via banner
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-bone">BOOKING CONTROL</h1>
          <p className="mt-1 text-sm text-white/50">
            Book for a member, change attendance status, cancel or remove any booking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-ember inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink-800"
        >
          <CalendarPlus className="h-4 w-4" />
          Add booking
        </button>
      </div>

      <ErrorBanner
        message={errorMessage(
          bookingsQuery.error ?? createBooking.error ?? updateStatus.error ?? remove.error,
        )}
      />

      <div className="glass-card flex flex-col gap-3 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, email or class"
            className="input pl-10"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | BookingStatus)}
          className="input sm:max-w-48"
          aria-label="Filter by booking status"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="attended">Attended</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="glass-card overflow-x-auto">
        {bookingsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading bookings…
          </div>
        ) : visible.length === 0 ? (
          <p className="p-12 text-center text-sm text-white/40">No bookings match this view.</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/35">
              <tr>
                <th className="px-5 py-4">Member</th>
                <th className="px-5 py-4">Class</th>
                <th className="px-5 py-4">When</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((booking) => (
                <tr key={booking.id} className="transition-colors hover:bg-white/[0.025]">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-bone">
                      {booking.profile?.full_name || 'Unnamed member'}
                    </div>
                    <div className="text-xs text-white/40">{booking.profile?.email}</div>
                  </td>
                  <td className="px-5 py-4 font-medium text-bone">
                    {booking.class?.title ?? 'Deleted class'}
                  </td>
                  <td className="px-5 py-4 text-white/55">
                    {booking.class ? formatFullDateTime(booking.class.schedule_time) : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={STATUS_TONES[booking.booking_status]}>
                      {booking.booking_status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={booking.booking_status}
                        disabled={updateStatus.isPending}
                        onChange={(e) =>
                          void updateStatus.mutateAsync([
                            booking.id,
                            e.target.value as BookingStatus,
                          ])
                        }
                        className="rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-xs text-white/70"
                        aria-label={`Status for ${booking.profile?.full_name ?? 'member'}`}
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="attended">Attended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <DangerButton
                        confirmMessage="Permanently delete this booking? The audit record will remain."
                        onConfirm={() => void remove.mutateAsync([booking.id])}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </DangerButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="ADD BOOKING">
        <ErrorBanner message={errorMessage(createBooking.error)} />
        <form onSubmit={handleCreate} className="space-y-5">
          <Field label="Member">
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="input"
            >
              <option value="">Select a member</option>
              {(usersQuery.data ?? [])
                .filter((user) => user.role === 'member')
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || 'Unnamed'} — {user.email}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Upcoming class">
            <select
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="input"
            >
              <option value="">Select a class</option>
              {upcomingClasses.map((gymClass) => (
                <option key={gymClass.id} value={gymClass.id}>
                  {gymClass.title} — {formatFullDateTime(gymClass.schedule_time)}
                </option>
              ))}
            </select>
          </Field>
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
              disabled={createBooking.isPending}
              className="btn-ember inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-ink-800"
            >
              {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add booking
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
