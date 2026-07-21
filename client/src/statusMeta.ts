import type { LeadStatus, LeadSource } from './types';

export const STATUS_ORDER: LeadStatus[] = [
  'not_home',
  'contacted',
  'interested',
  'demo_scheduled',
  'demo_complete',
  'closed_won',
  'closed_lost',
  'callback_later',
];

export const STATUS_META: Record<
  LeadStatus,
  { label: string; color: string; bg: string; text: string; ring: string }
> = {
  not_home: {
    label: 'Not Home',
    color: '#94a3b8',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    ring: 'ring-slate-300',
  },
  contacted: {
    label: 'Contacted',
    color: '#38bdf8',
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    ring: 'ring-sky-300',
  },
  interested: {
    label: 'Interested',
    color: '#fbbf24',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    ring: 'ring-amber-300',
  },
  demo_scheduled: {
    label: 'Demo Scheduled',
    color: '#a78bfa',
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    ring: 'ring-violet-300',
  },
  demo_complete: {
    label: 'Demo Complete',
    color: '#818cf8',
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    ring: 'ring-indigo-300',
  },
  closed_won: {
    label: 'Closed Won',
    color: '#34d399',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    ring: 'ring-emerald-300',
  },
  closed_lost: {
    label: 'Closed Lost',
    color: '#f87171',
    bg: 'bg-red-100',
    text: 'text-red-700',
    ring: 'ring-red-300',
  },
  callback_later: {
    label: 'Callback Later',
    color: '#fb923c',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    ring: 'ring-orange-300',
  },
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  d2d: 'D2D',
  referral: 'Referral',
  callback: 'Callback',
};

export function fullAddress(lead: { street: string; city: string; zip: string | null }): string {
  return `${lead.street}, ${lead.city}${lead.zip ? ' ' + lead.zip : ''}`;
}

export function formatDateTime(iso: string): string {
  const normalized = iso.length === 16 ? `${iso}:00` : iso;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
