import type { Metadata } from 'next';
import { ContentManager } from '@/components/admin/content-manager';

export const metadata: Metadata = { title: 'Content Management' };

export default function AdminContentPage() {
  return <ContentManager />;
}
