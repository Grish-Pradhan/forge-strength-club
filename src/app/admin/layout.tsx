import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard-shell';

export const metadata: Metadata = {
  title: 'Admin Panel',
  description: 'Command center — users, classes and content.',
  robots: { index: false },
};

/** Admin Panel layout — access enforced by middleware (role = admin). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell area="admin" title="Admin Panel">
      {children}
    </DashboardShell>
  );
}
