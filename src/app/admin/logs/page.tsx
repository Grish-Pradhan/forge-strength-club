import type { Metadata } from 'next';
import { AuditLogManager } from '@/components/admin/audit-log-manager';

export const metadata: Metadata = { title: 'Activity & Security Logs' };

export default function AdminLogsPage() {
  return <AuditLogManager />;
}
