import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { QueryProvider } from '@/providers/query-provider';
import { ActivityTracker } from '@/components/activity-tracker';
import { ThemeProvider } from '@/providers/theme-provider';
import { getGlobalTheme } from '@/lib/services/theme';
import { DEFAULT_THEME } from '@/lib/themes';

/**
 * Fonts: Bebas Neue (display) + Inter (body), loaded via Google Fonts
 * <link> with preconnect — self-hosted-grade performance without the
 * next/font build-time fetch (which can be brittle in some environments).
 * Exposed as CSS variables --font-display / --font-sans (see globals.css).
 */

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const metadataOrigin = configuredSiteUrl
  ? configuredSiteUrl.startsWith('http')
    ? configuredSiteUrl
    : `https://${configuredSiteUrl}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render the saved theme in the first HTML response, avoiding a default flash.
  const initialTheme = await getGlobalTheme().catch(() => DEFAULT_THEME);
  return (
    <html lang="en" data-theme={initialTheme.theme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider initialTheme={initialTheme}>
          <QueryProvider>
            <AuthProvider>
              <ActivityTracker />
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
