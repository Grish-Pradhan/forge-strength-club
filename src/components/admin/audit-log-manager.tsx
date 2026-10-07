'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Loader2, Search, ShieldAlert, UserRound } from 'lucide-react';
import { useAdminAuditLogs } from '@/lib/hooks/use-admin-data';
import type { AuditCategory, AuditSeverity } from '@/lib/types';
import { errorMessage, formatFullDateTime } from '@/lib/utils';
import { Badge, ErrorBanner } from './shared';

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  activity: 'Visit',
  booking: 'Booking',
  auth: 'Account',
  admin: 'Admin',
  security: 'Security',
};

const SEVERITY_TONES: Record<AuditSeverity, 'neutral' | 'success' | 'warning' | 'danger'> = {
  info: 'neutral',
  success: 'success',
  warning: 'warning',
  critical: 'danger',
};

export function AuditLogManager() {
  const logsQuery = useAdminAuditLogs();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | AuditCategory>('all');
  const [severity, setSeverity] = useState<'all' | AuditSeverity>('all');
  const logs = logsQuery.data ?? [];

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return logs.filter((event) => {
      const haystack = `${event.description} ${event.actor_name ?? ''} ${event.actor_email ?? ''} ${event.ip_address ?? ''} ${event.path ?? ''}`.toLowerCase();
      return (
        (category === 'all' || event.category === category) &&
        (severity === 'all' || event.severity === severity) &&
        (!needle || haystack.includes(needle))
      );
    });
  }, [category, logs, search, severity]);

  const lastDay = Date.now() - 24 * 60 * 60 * 1000;
  const recent = logs.filter((event) => new Date(event.created_at).getTime() >= lastDay);
  const stats = [
    { label: 'Events (24h)', value: recent.length, icon: Activity, tone: 'text-ember' },
    {
      label: 'Security flags',
      value: recent.filter((event) => event.category === 'security').length,
      icon: ShieldAlert,
      tone: 'text-red-400',
    },
    {
      label: 'Warnings',
      value: recent.filter((event) => ['warning', 'critical'].includes(event.severity)).length,
      icon: AlertTriangle,
      tone: 'text-gold',
    },
    {
      label: 'Known users',
      value: new Set(recent.map((event) => event.actor_id).filter(Boolean)).size,
      icon: UserRound,
      tone: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-bone">ACTIVITY & SECURITY</h1>
        <p className="mt-1 text-sm text-white/50">
          A private record of visits, account events, bookings, admin changes and blocked activity.
        </p>
      </div>

      <ErrorBanner message={errorMessage(logsQuery.error)} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <stat.icon className={`h-5 w-5 ${stat.tone}`} />
            <div className="font-display mt-3 text-4xl text-bone">{stat.value}</div>
            <div className="text-xs uppercase tracking-wider text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, IP, page or action"
            className="input pl-10"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | AuditCategory)}
          className="input"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as 'all' | AuditSeverity)}
          className="input"
          aria-label="Filter by severity"
        >
          <option value="all">All severity</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="space-y-3">
        {logsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-white/40">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading activity…
          </div>
        ) : visible.length === 0 ? (
          <div className="glass-card p-12 text-center text-sm text-white/40">
            No activity matches these filters.
          </div>
        ) : (
          visible.map((event) => (
            <article key={event.id} className="glass-card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={event.category === 'security' ? 'danger' : 'ember'}>
                      {CATEGORY_LABELS[event.category]}
                    </Badge>
                    <Badge tone={SEVERITY_TONES[event.severity]}>{event.severity}</Badge>
                    <time className="text-xs text-white/35">
                      {formatFullDateTime(event.created_at)}
                    </time>
                  </div>
                  <p className="mt-3 font-semibold text-bone">{event.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
                    <span>
                      By: <strong className="text-white/70">{event.actor_name || 'Anonymous visitor'}</strong>
                      {event.actor_email ? ` (${event.actor_email})` : ''}
                    </span>
                    <span>IP: <strong className="text-white/70">{event.ip_address || 'Unavailable'}</strong></span>
                    <span>Where: <strong className="text-white/70">{event.path || 'Server action'}</strong></span>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <p className="text-xs leading-relaxed text-white/30">
        Showing the newest 500 records. Logs are append-only in the admin UI and refresh every 30 seconds.
      </p>
    </div>
  );
}
