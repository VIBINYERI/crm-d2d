import { Router } from 'express';
import { db, logActivity, now } from '../db.js';
import { STATUSES, STATUS_LABELS, SOURCES, type LeadStatus } from '../statuses.js';
import { geocode } from '../services/geocode.js';
import * as google from '../services/google.js';
import { buildEventInput, fullAddress, type LeadRow } from '../services/calendarSync.js';

export const leadsRouter = Router();

const getLead = (id: number | string) =>
  db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as (LeadRow & Record<string, unknown>) | undefined;

function withActivity(lead: LeadRow & Record<string, unknown>) {
  const activity = db
    .prepare('SELECT * FROM activity_log WHERE lead_id = ? ORDER BY created_at DESC, id DESC')
    .all(lead.id);
  return { ...lead, activity };
}

// List leads with optional filters: ?status=&city=&q=&source=
leadsRouter.get('/', (req, res) => {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const { status, city, q, source } = req.query;
  if (typeof status === 'string' && status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (typeof city === 'string' && city) {
    clauses.push('LOWER(city) = LOWER(?)');
    params.push(city);
  }
  if (typeof source === 'string' && source) {
    clauses.push('source = ?');
    params.push(source);
  }
  if (typeof q === 'string' && q) {
    clauses.push('(street LIKE ? OR homeowner_name LIKE ? OR notes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM leads ${where} ORDER BY updated_at DESC`)
    .all(...params);
  res.json(rows);
});

leadsRouter.get('/:id', (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json(withActivity(lead));
});

// Create a door/lead. Only street + city are required so the quick-add flow
// stays fast; everything else is optional at capture time.
leadsRouter.post('/', async (req, res) => {
  const {
    street,
    city,
    zip,
    status = 'not_home',
    homeowner_name,
    phone,
    email,
    notes = '',
    source = 'd2d',
    assigned_rep_id = 1,
    follow_up_at,
  } = req.body ?? {};

  if (!street || !city) {
    res.status(400).json({ error: 'street and city are required' });
    return;
  }
  if (!STATUSES.includes(status)) {
    res.status(400).json({ error: `Invalid status: ${status}` });
    return;
  }
  if (!SOURCES.includes(source)) {
    res.status(400).json({ error: `Invalid source: ${source}` });
    return;
  }

  const coords = await geocode(street, city, zip);
  const ts = now();
  const result = db
    .prepare(
      `INSERT INTO leads (street, city, zip, lat, lng, status, homeowner_name, phone, email,
                          notes, source, assigned_rep_id, follow_up_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      street,
      city,
      zip ?? null,
      coords?.lat ?? null,
      coords?.lng ?? null,
      status,
      homeowner_name ?? null,
      phone ?? null,
      email ?? null,
      notes,
      source,
      assigned_rep_id,
      follow_up_at ?? null,
      ts,
      ts
    );

  const id = Number(result.lastInsertRowid);
  logActivity(id, 'created', `Door added — ${STATUS_LABELS[status as LeadStatus]}`, status);
  res.status(201).json(withActivity(getLead(id)!));
});

leadsRouter.patch('/:id', async (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const allowed = [
    'street',
    'city',
    'zip',
    'status',
    'homeowner_name',
    'phone',
    'email',
    'notes',
    'source',
    'assigned_rep_id',
    'follow_up_at',
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in (req.body ?? {})) updates[key] = req.body[key];
  }

  if ('status' in updates && !STATUSES.includes(updates.status as LeadStatus)) {
    res.status(400).json({ error: `Invalid status: ${updates.status}` });
    return;
  }
  if ('source' in updates && !SOURCES.includes(updates.source as never)) {
    res.status(400).json({ error: `Invalid source: ${updates.source}` });
    return;
  }

  // Re-geocode when the address changes
  const addressChanged =
    ('street' in updates && updates.street !== lead.street) ||
    ('city' in updates && updates.city !== lead.city) ||
    ('zip' in updates && updates.zip !== lead.zip);
  if (addressChanged) {
    const coords = await geocode(
      (updates.street as string) ?? lead.street,
      (updates.city as string) ?? lead.city,
      (updates.zip as string) ?? lead.zip
    );
    updates.lat = coords?.lat ?? null;
    updates.lng = coords?.lng ?? null;
  }

  const statusChanged = 'status' in updates && updates.status !== lead.status;

  if (Object.keys(updates).length) {
    updates.updated_at = now();
    const setSql = Object.keys(updates)
      .map((k) => `${k} = ?`)
      .join(', ');
    db.prepare(`UPDATE leads SET ${setSql} WHERE id = ?`).run(
      ...Object.values(updates),
      lead.id
    );
  }

  if (statusChanged) {
    const newStatus = updates.status as LeadStatus;
    logActivity(
      lead.id,
      'status',
      `Status changed: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[newStatus]}`,
      newStatus
    );

    // Leaving demo_scheduled without completing it cancels the calendar event.
    if (
      lead.gcal_event_id &&
      lead.status === 'demo_scheduled' &&
      !['demo_complete', 'closed_won', 'closed_lost'].includes(newStatus)
    ) {
      try {
        await google.deleteEvent(lead.gcal_event_id);
        db.prepare(
          'UPDATE leads SET gcal_event_id = NULL, demo_start = NULL, demo_duration_min = NULL WHERE id = ?'
        ).run(lead.id);
        logActivity(lead.id, 'calendar', 'Demo appointment removed from Google Calendar');
      } catch (err) {
        console.error('Failed to delete calendar event:', err);
      }
    }
  }

  res.json(withActivity(getLead(lead.id)!));
});

leadsRouter.delete('/:id', async (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  if (lead.gcal_event_id) {
    try {
      await google.deleteEvent(lead.gcal_event_id);
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
    }
  }
  db.prepare('DELETE FROM leads WHERE id = ?').run(lead.id);
  res.json({ ok: true });
});

// Schedule (or reschedule) a demo: creates/updates the real Google Calendar
// event and stores its ID on the lead.
leadsRouter.post('/:id/schedule', async (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  const { start, duration_min } = req.body ?? {};
  if (typeof start !== 'string' || !start) {
    res.status(400).json({ error: 'start (YYYY-MM-DDTHH:mm) is required' });
    return;
  }
  const duration = Number(duration_min) || 60;

  let eventId = lead.gcal_event_id;
  let calendarSynced = false;
  let calendarError: string | null = null;

  const input = buildEventInput({ ...lead, status: 'demo_scheduled' }, start, duration);
  if (google.isConnected()) {
    try {
      if (eventId) {
        await google.updateEvent(eventId, input);
      } else {
        eventId = await google.createEvent(input);
      }
      calendarSynced = true;
    } catch (err) {
      console.error('Calendar sync failed:', err);
      calendarError = err instanceof Error ? err.message : 'Calendar sync failed';
    }
  } else {
    calendarError = 'Google Calendar is not connected — demo saved in CRM only';
  }

  const wasScheduled = lead.status === 'demo_scheduled';
  db.prepare(
    `UPDATE leads SET status = 'demo_scheduled', demo_start = ?, demo_duration_min = ?,
                      gcal_event_id = ?, updated_at = ? WHERE id = ?`
  ).run(start, duration, eventId ?? null, now(), lead.id);

  if (!wasScheduled) {
    logActivity(
      lead.id,
      'status',
      `Status changed: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS.demo_scheduled}`,
      'demo_scheduled'
    );
  }
  const whenLabel = `${start.slice(0, 10)} ${start.slice(11, 16)}`;
  logActivity(
    lead.id,
    'calendar',
    calendarSynced
      ? `Demo ${wasScheduled ? 'rescheduled' : 'scheduled'} for ${whenLabel} (${duration} min) — synced to Google Calendar`
      : `Demo ${wasScheduled ? 'rescheduled' : 'scheduled'} for ${whenLabel} (${duration} min)`
  );

  res.json({ ...withActivity(getLead(lead.id)!), calendar_synced: calendarSynced, calendar_error: calendarError });
});

// Cancel a scheduled demo: deletes the Google Calendar event and moves the
// lead to the given status (default callback_later).
leadsRouter.delete('/:id/schedule', async (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  const nextStatus = (req.query.next_status as string) || 'callback_later';
  if (!STATUSES.includes(nextStatus as LeadStatus)) {
    res.status(400).json({ error: `Invalid status: ${nextStatus}` });
    return;
  }

  if (lead.gcal_event_id) {
    try {
      await google.deleteEvent(lead.gcal_event_id);
      logActivity(lead.id, 'calendar', 'Demo appointment removed from Google Calendar');
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
    }
  }

  db.prepare(
    `UPDATE leads SET status = ?, demo_start = NULL, demo_duration_min = NULL,
                      gcal_event_id = NULL, updated_at = ? WHERE id = ?`
  ).run(nextStatus, now(), lead.id);

  if (lead.status !== nextStatus) {
    logActivity(
      lead.id,
      'status',
      `Status changed: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[nextStatus as LeadStatus]}`,
      nextStatus
    );
  }
  res.json(withActivity(getLead(lead.id)!));
});

export { fullAddress };
