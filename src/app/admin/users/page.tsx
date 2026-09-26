import type { Metadata } from 'next';
import { UserManager } from '@/components/admin/user-manager';

export const metadata: Metadata = { title: 'User Management' };

export default function AdminUsersPage() {
  return <UserManager />;
}
