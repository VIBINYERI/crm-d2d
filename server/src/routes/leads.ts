import { Router } from 'express';
import { logActivity, now, one, q, run } from '../db.js';
import { STATUSES, STATUS_LABELS, SOURCES, type LeadStatus } from '../statuses.js';
import { geocode } from '../services/geocode.js';
import * as google from '../services/google.js';
import { buildEventInput, type LeadRow } from '../services/calendarSync.js';

export const leadsRouter = Router();

type FullLead = LeadRow & Record<string, unknown>;

const getLead = (id: number | string) =>
  one<FullLead>('SELECT * FROM leads WHERE id = $1', [id]);

async function withActivity(lead: FullLead) {
  const activity = await q(
    'SELECT * FROM activity_log WHERE lead_id = $1 ORDER BY created_at DESC, id DESC',
    [lead.id]
  );
  return { ...lead, activity };
}

// List leads with optional filters: ?status=&city=&q=&source=
leadsRouter.get('/', async (req, res) => {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const { status, city, q: search, source } = req.query;
  const add = (clause: string, value: unknown) => {
    params.push(value);
    clauses.push(clause.replace('?', `$${params.length}`));
  };
  if (typeof status === 'string' && status) add('status = ?', status);
  if (typeof city === 'string' && city) add('LOWER(city) = LOWER(?)', city);
  if (typeof source === 'string' && source) add('source = ?', source);
  if (typeof search === 'string' && search) {
    params.push(`%${search}%`);
    const n = `$${params.length}`;
    clauses.push(`(street ILIKE ${n} OR homeowner_name ILIKE ${n} OR notes ILIKE ${n})`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  res.json(await q(`SELECT * FROM leads ${where} ORDER BY updated_at DESC`, params));
});

leadsRouter.get('/:id', async (req, res) => {
  const lead = await getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json(await withActivity(lead));
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
  const inserted = await one<{ id: number }>(
    `INSERT INTO leads (street, city, zip, lat, lng, status, homeowner_name, phone, email,
                        notes, source, assigned_rep_id, follow_up_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
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
      ts,
    ]
  );

  const id = inserted!.id;
  await logActivity(id, 'created', `Door added — ${STATUS_LABELS[status as LeadStatus]}`, status);
  res.status(201).json(await withActivity((await getLead(id))!));
});

leadsRouter.patch('/:id', async (req, res) => {
  const lead = await getLead(req.params.id);
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
    const keys = Object.keys(updates);
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await run(`UPDATE leads SET ${setSql} WHERE id = $${keys.length + 1}`, [
      ...keys.map((k) => updates[k]),
      lead.id,
    ]);
  }

  if (statusChanged) {
    const newStatus = updates.status as LeadStatus;
    await logActivity(
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
        await run(
          'UPDATE leads SET gcal_event_id = NULL, demo_start = NULL, demo_duration_min = NULL WHERE id = $1',
          [lead.id]
        );
        await logActivity(lead.id, 'calendar', 'Demo appointment removed from Google Calendar');
      } catch (err) {
        console.error('Failed to delete calendar event:', err);
      }
    }
  }

  res.json(await withActivity((await getLead(lead.id))!));
});

leadsRouter.delete('/:id', async (req, res) => {
  const lead = await getLead(req.params.id);
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
  await run('DELETE FROM leads WHERE id = $1', [lead.id]);
  res.json({ ok: true });
});

// Schedule (or reschedule) a demo: creates/updates the real Google Calendar
// event and stores its ID on the lead.
leadsRouter.post('/:id/schedule', async (req, res) => {
  const lead = await getLead(req.params.id);
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
  if (await google.isConnected()) {
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
  await run(
    `UPDATE leads SET status = 'demo_scheduled', demo_start = $1, demo_duration_min = $2,
                      gcal_event_id = $3, updated_at = $4 WHERE id = $5`,
    [start, duration, eventId ?? null, now(), lead.id]
  );

  if (!wasScheduled) {
    await logActivity(
      lead.id,
      'status',
      `Status changed: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS.demo_scheduled}`,
      'demo_scheduled'
    );
  }
  const whenLabel = `${start.slice(0, 10)} ${start.slice(11, 16)}`;
  await logActivity(
    lead.id,
    'calendar',
    calendarSynced
      ? `Demo ${wasScheduled ? 'rescheduled' : 'scheduled'} for ${whenLabel} (${duration} min) — synced to Google Calendar`
      : `Demo ${wasScheduled ? 'rescheduled' : 'scheduled'} for ${whenLabel} (${duration} min)`
  );

  res.json({
    ...(await withActivity((await getLead(lead.id))!)),
    calendar_synced: calendarSynced,
    calendar_error: calendarError,
  });
});

// Cancel a scheduled demo: deletes the Google Calendar event and moves the
// lead to the given status (default callback_later).
leadsRouter.delete('/:id/schedule', async (req, res) => {
  const lead = await getLead(req.params.id);
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
      await logActivity(lead.id, 'calendar', 'Demo appointment removed from Google Calendar');
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
    }
  }

  await run(
    `UPDATE leads SET status = $1, demo_start = NULL, demo_duration_min = NULL,
                      gcal_event_id = NULL, updated_at = $2 WHERE id = $3`,
    [nextStatus, now(), lead.id]
  );

  if (lead.status !== nextStatus) {
    await logActivity(
      lead.id,
      'status',
      `Status changed: ${STATUS_LABELS[lead.status]} → ${STATUS_LABELS[nextStatus as LeadStatus]}`,
      nextStatus
    );
  }
  res.json(await withActivity((await getLead(lead.id))!));
});
