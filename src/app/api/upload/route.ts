import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_BUCKETS = ['avatars', 'class-covers', 'site-assets'] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: please sign in.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const bucket = (formData.get('bucket') as string) || 'avatars';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json({ error: `Invalid bucket: ${bucket}` }, { status: 400 });
    }

    // If uploading class covers or site assets, verify admin role
    if (bucket === 'class-covers' || bucket === 'site-assets') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: only admins can upload site or class assets.' },
          { status: 403 },
        );
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum allowed size is 10MB.' },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create unique sanitized filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const filePath = `${user.id}/${Date.now()}-${cleanName}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Upload API Error]', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      bucket,
      path: filePath,
    });
  } catch (err: unknown) {
    console.error('[Upload API Exception]', err);
    const msg = err instanceof Error ? err.message : 'Upload failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
