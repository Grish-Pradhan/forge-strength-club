'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared admin UI primitives — modal dialog, form field wrapper, inline
 * status banners and the badge component used across data tables.
 */

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'glass-card max-h-[90vh] w-full overflow-y-auto bg-ink-700 p-6 sm:p-8',
              wide ? 'max-w-2xl' : 'max-w-lg',
            )}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-3xl tracking-wide text-bone">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-bone"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Field wrapper ---------- */

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/* ---------- Status banners ---------- */

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      {message}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
    >
      {message}
    </div>
  );
}

/* ---------- Badges ---------- */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'ember';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/10 text-white/70',
    success: 'bg-emerald-500/15 text-emerald-400',
    danger: 'bg-red-500/15 text-red-400',
    warning: 'bg-gold/15 text-gold',
    ember: 'bg-ember/15 text-ember',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Confirm dialog helper ---------- */

export function DangerButton({
  children,
  onConfirm,
  confirmMessage,
  disabled,
}: {
  children: ReactNode;
  onConfirm: () => void;
  confirmMessage: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (window.confirm(confirmMessage)) onConfirm();
      }}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 transition-all hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
