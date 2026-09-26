import type { Metadata } from 'next';
import { ClassManager } from '@/components/admin/class-manager';

export const metadata: Metadata = { title: 'Class Management' };

export default function AdminClassesPage() {
  return <ClassManager />;
}
