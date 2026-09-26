import Link from 'next/link';
import { BrandLogo } from '@/components/logo';

export default function NotFound() {
  return (
    <div className="grain-bg flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <BrandLogo size={110} />
      <h1 className="font-display mt-8 text-7xl text-bone">
        4<span className="text-ember">0</span>4
      </h1>
      <p className="mt-3 max-w-sm text-white/55">
        This page skipped leg day. Let's get you back to the floor.
      </p>
      <Link
        href="/"
        className="btn-ember mt-8 rounded-xl px-8 py-3.5 text-sm font-bold text-ink-800"
      >
        Back to home
      </Link>
    </div>
  );
}
