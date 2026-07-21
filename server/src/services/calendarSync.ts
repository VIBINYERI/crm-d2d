import { env } from '../env.js';
import type { EventInput } from './google.js';
import { STATUS_LABELS, type LeadStatus } from '../statuses.js';

export interface LeadRow {
  id: number;
  street: string;
  city: string;
  zip: string | null;
  status: LeadStatus;
  homeowner_name: string | null;
  phone: string | null;
  notes: string;
  demo_start: string | null;
  demo_duration_min: number | null;
  gcal_event_id: string | null;
}

export function fullAddress(lead: Pick<LeadRow, 'street' | 'city' | 'zip'>): string {
  return `${lead.street}, ${lead.city}, IL${lead.zip ? ' ' + lead.zip : ''}`;
}

export function buildEventInput(
  lead: LeadRow,
  startLocal: string,
  durationMin: number
): EventInput {
  const address = fullAddress(lead);
  const start = startLocal.length === 16 ? `${startLocal}:00` : startLocal;
  const startDate = new Date(`${start}Z`); // treat as wall-clock; only used for arithmetic
  const endDate = new Date(startDate.getTime() + durationMin * 60_000);
  const end = endDate.toISOString().slice(0, 19);

  const lines = [
    `Address: ${address}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.homeowner_name ? `Homeowner: ${lead.homeowner_name}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    `Status: ${STATUS_LABELS[lead.status]}`,
    '',
    `CRM record: ${env.appUrl}/doors/${lead.id}`,
  ].filter((l): l is string => l !== null);

  return {
    summary: `Window Demo - ${lead.homeowner_name || address}`,
    description: lines.join('\n'),
    location: address,
    startIso: start,
    endIso: end,
  };
}
