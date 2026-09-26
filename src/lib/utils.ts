/** Merge class names, skipping falsy values (tiny clsx-style helper). */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ');
}

/** Format an ISO timestamp as e.g. "Mon · 6:00 AM". */
export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Format an ISO timestamp as e.g. "Mon, Sep 28 · 6:00 AM". */
export function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

/**
 * Format price in Nepali Rupees, e.g. "Rs. 2,500".
 * Uses lakh-style grouping (en-IN) which matches Nepali number conventions,
 * and drops decimals for whole rupee amounts.
 */
export function formatPrice(price: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
  return `Rs. ${formatted}`;
}

/** "Maya Kowalski" -> "MK" (avatar initials). */
export function initials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/**
 * Extract a human-readable message from a Supabase / PostgREST error.
 * Returns null when there is no error — so callers can render error banners
 * conditionally without showing a false "Something went wrong." on load.
 */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong.',
): string | null {
  if (!err) return null;
  let raw = '';
  if (typeof err === 'string') raw = err;
  else if (err instanceof Error) raw = err.message;
  else {
    const anyErr = err as { message?: string; details?: string; hint?: string };
    raw = anyErr.message || anyErr.details || anyErr.hint || fallback;
  }
  if (!raw.trim()) return fallback;

  // Friendly human mappings for Supabase RPC & RLS errors
  if (raw.includes('MEMBERSHIP_INACTIVE')) {
    return 'Your membership is currently inactive. Please choose or activate a plan in Profile & Billing to book classes.';
  }
  if (raw.includes('ALREADY_BOOKED')) {
    return 'You have already booked a spot in this class.';
  }
  if (raw.includes('CLASS_FULL')) {
    return 'This class has reached full capacity.';
  }
  if (raw.includes('CLASS_STARTED')) {
    return 'This class has already started.';
  }
  if (raw.includes('CLASS_NOT_FOUND')) {
    return 'Class not found or no longer available.';
  }
  if (raw.includes('NOT_AUTHENTICATED')) {
    return 'Please sign in to complete this action.';
  }
  if (raw.includes('FORBIDDEN: role changes require admin privileges')) {
    return 'You do not have permission to alter user roles.';
  }
  if (raw.includes('JWT') || raw.includes('JWT expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  return raw;
}
