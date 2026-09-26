import type { Metadata } from 'next';
import { ProfileForm } from '@/components/dashboard/profile-form';

export const metadata: Metadata = {
  title: 'Profile & Settings',
};

/** Member profile/settings page. */
export default function ProfilePage() {
  return <ProfileForm />;
}
