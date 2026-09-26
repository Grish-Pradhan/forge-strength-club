import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { QueryProvider } from '@/providers/query-provider';

/**
 * Fonts: Bebas Neue (display) + Inter (body), loaded via Google Fonts
 * <link> with preconnect — self-hosted-grade performance without the
 * next/font build-time fetch (which can be brittle in some environments).
 * Exposed as CSS variables --font-display / --font-sans (see globals.css).
 */

export const metadata: Metadata = {
  title: {
    default: 'Forge Strength Club — Forge Your Strongest Self',
    template: '%s · Forge Strength Club',
  },
  description:
    'No shortcuts. Just iron, coaching that cares, and a community that shows up. Classes, personal training, recovery lab and membership plans.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Forge Strength Club — Forge Your Strongest Self',
    description:
      'No shortcuts. Just iron, coaching that cares, and a community that shows up.',
    images: [{ url: '/logo.png', width: 1254, height: 1254, alt: 'Forge Strength Club' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forge Strength Club — Forge Your Strongest Self',
    description:
      'No shortcuts. Just iron, coaching that cares, and a community that shows up.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
