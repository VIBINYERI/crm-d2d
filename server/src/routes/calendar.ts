import { Router } from 'express';
import * as google from '../services/google.js';
import { db } from '../db.js';
import { env } from '../env.js';

export const calendarRouter = Router();

// Start of the current week (Monday) in the configured timezone, as a UTC Date.
function weekBounds(offsetWeeks = 0): { start: Date; end: Date } {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: env.timezone }));
  const tzDiff = now.getTime() - local.getTime();
  const day = (local.getDay() + 6) % 7; // Monday = 0
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() - day + offsetWeeks * 7);
  const start = new Date(local.getTime() + tzDiff);
  const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
  return { start, end };
}

// This week's events, read live from Google Calendar. Falls back to
// CRM-scheduled demos when Google isn't connected so the view still works.
calendarRouter.get('/week', async (req, res) => {
  const offset = Number(req.query.offset) || 0;
  const { start, end } = weekBounds(offset);

  if (!google.isConnected()) {
    const demos = db
      .prepare(
        `SELECT id, street, city, zip, homeowner_name, demo_start, demo_duration_min
         FROM leads WHERE demo_start IS NOT NULL ORDER BY demo_start`
      )
      .all() as Array<{
      id: number;
      street: string;
      city: string;
      zip: string | null;
      homeowner_name: string | null;
      demo_start: string;
      demo_duration_min: number | null;
    }>;
    const events = demos
      .filter((d) => {
        const t = new Date(`${d.demo_start.length === 16 ? d.demo_start + ':00' : d.demo_start}`);
        return t >= start && t < end;
      })
      .map((d) => ({
        id: `crm-${d.id}`,
        summary: `Window Demo - ${d.homeowner_name || `${d.street}, ${d.city}`}`,
        location: `${d.street}, ${d.city}, IL${d.zip ? ' ' + d.zip : ''}`,
        start: d.demo_start,
        end: d.demo_start,
        isDemo: true,
        htmlLink: null,
        leadId: d.id,
      }));
    res.json({ connected: false, weekStart: start.toISOString(), events });
    return;
  }

  try {
    const events = await google.listEvents(start.toISOString(), end.toISOString());
    // Attach lead IDs to events we created, so the UI can link back.
    const leads = db
      .prepare('SELECT id, gcal_event_id FROM leads WHERE gcal_event_id IS NOT NULL')
      .all() as Array<{ id: number; gcal_event_id: string }>;
    const byEventId = new Map(leads.map((l) => [l.gcal_event_id, l.id]));
    res.json({
      connected: true,
      weekStart: start.toISOString(),
      events: events.map((e) => ({ ...e, leadId: byEventId.get(e.id) ?? null })),
    });
  } catch (err) {
    console.error('Calendar week fetch failed:', err);
    res.status(502).json({ error: 'Failed to fetch Google Calendar events' });
  }
});
