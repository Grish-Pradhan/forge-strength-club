import { NextResponse } from 'next/server';
import { getGlobalTheme } from '@/lib/services/theme';
import { DEFAULT_THEME } from '@/lib/themes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  try {
    return NextResponse.json(await getGlobalTheme(), { headers });
  } catch {
    // Existing pages keep their last confirmed theme during an outage.
    return NextResponse.json(
      { ...DEFAULT_THEME, error: 'Theme service is temporarily unavailable.' },
      { status: 503, headers },
    );
  }
}
