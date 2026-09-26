'use client';

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, Image as ImageIcon, Loader2, X, Check, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  bucket?: 'avatars' | 'class-covers' | 'site-assets';
  label?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  className?: string;
  placeholder?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'avatars',
  label,
  aspectRatio = 'square',
  className,
  placeholder = 'Upload image (JPG, PNG, WebP up to 10MB)',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [manualUrlMode, setManualUrlMode] = useState(false);
  const [manualUrl, setManualUrl] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      onChange(data.url);
      setManualUrl(data.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      void handleFile(e.target.files[0]);
    }
  }

  function handleClear() {
    onChange('');
    setManualUrl('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const aspectClasses = {
    square: 'aspect-square max-w-[160px]',
    video: 'aspect-video w-full max-h-[220px]',
    banner: 'aspect-[21/9] w-full max-h-[240px]',
  }[aspectRatio];

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="label mb-0">{label}</label>
          <button
            type="button"
            onClick={() => setManualUrlMode(!manualUrlMode)}
            className="flex items-center gap-1 text-[11px] text-ember/80 hover:text-ember transition-colors"
          >
            <LinkIcon className="h-3 w-3" />
            {manualUrlMode ? 'Upload from device' : 'Enter URL instead'}
          </button>
        </div>
      )}

      {manualUrlMode ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => {
              setManualUrl(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="https://images.unsplash.com/..."
            className="input text-xs"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-white/10 px-3 text-xs text-white/50 hover:border-red-500/40 hover:text-red-400 transition-all"
            >
              Clear
            </button>
          )}
        </div>
      ) : value ? (
        /* Image Preview State */
        <div className="relative group overflow-hidden rounded-xl border border-white/15 bg-ink-900 shadow-md">
          <div className={cn('relative w-full overflow-hidden', aspectClasses)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded preview"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setError('Image failed to load. Check URL.')}
            />
          </div>
          <div className="absolute inset-0 bg-ink-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-ember px-3 py-1.5 text-xs font-bold text-ink-900 rounded-lg shadow-lg flex items-center gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-bold shadow-lg flex items-center gap-1.5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* Drag & Drop Upload Zone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 flex flex-col items-center justify-center gap-2.5',
            dragOver
              ? 'border-ember bg-ember/10 shadow-[0_0_20px_rgba(255,90,31,0.2)]'
              : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]',
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-7 w-7 text-ember animate-spin" />
              <span className="text-xs text-white/60">Uploading to Supabase Storage…</span>
            </div>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-ember/15 flex items-center justify-center text-ember">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-bone">
                  Click to upload or drag & drop
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">{placeholder}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5 mt-1">
          <X className="h-3.5 w-3.5 flex-none" />
          {error}
        </p>
      )}
    </div>
  );
}
