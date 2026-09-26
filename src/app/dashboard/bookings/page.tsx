import type { Metadata } from 'next';
import { BookingsManager } from '@/components/dashboard/bookings-manager';

export const metadata: Metadata = {
  title: 'Schedule & Bookings',
};

/** Member bookings page — one-click booking + booking management. */
export default function BookingsPage() {
  return <BookingsManager />;
}
