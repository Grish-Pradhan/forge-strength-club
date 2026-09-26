import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard-shell';

export const metadata: Metadata = {
  title: 'Member Dashboard',
  description: 'Your classes, bookings and profile — Forge Strength Club.',
};

/** Member Dashboard layout — shared shell with role-aware sidebar. */
export default function MemberDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell area="member" title="Member Dashboard">
      {children}
    </DashboardShell>
  );
}
