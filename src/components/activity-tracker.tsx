'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function recordClientActivity(
  eventType: string,
  input: { path?: string; email?: string; name?: string } = {},
) {
  return fetch('/api/activity', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventType, path: input.path ?? window.location.pathname, ...input }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Records one private page-view event whenever the app route changes. */
export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void recordClientActivity('page_view', { path: pathname });
  }, [pathname]);

  return null;
}
