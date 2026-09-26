'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * React Query provider.
 *
 * Global defaults tuned for fast, seamless navigation:
 *  - 60s stale time — navigating between pages reuses cached data instead
 *    of refetching on every mount (mutations invalidate precisely).
 *  - 1 retry (Supabase free tier occasionally cold-starts).
 *  - refetchOnWindowFocus OFF — refocusing a tab no longer triggers a wave
 *    of refetches; live invalidations keep data fresh where it matters.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
