import type { Metadata } from 'next';
import { AdminBookingsManager } from '@/components/admin/bookings-manager';

export const metadata: Metadata = { title: 'Booking Management' };

export default function AdminBookingsPage() {
  return <AdminBookingsManager />;
}
