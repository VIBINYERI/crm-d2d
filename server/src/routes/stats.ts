import { Router } from 'express';
import { db } from '../db.js';
import { env } from '../env.js';
import { CONTACT_STATUSES } from '../statuses.js';

export const statsRouter = Router();

function startOfTodayISO(): string {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: env.timezone }));
  const tzDiff = now.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + tzDiff).toISOString();
}

statsRouter.get('/', (_req, res) => {
  const todayStart = startOfTodayISO();

  const doorsToday = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM activity_log WHERE type = 'created' AND created_at >= ?`)
      .get(todayStart) as { n: number }
  ).n;

  const contactPlaceholders = CONTACT_STATUSES.map(() => '?').join(', ');
  const contactedToday = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) AS n FROM activity_log
         WHERE created_at >= ? AND meta IN (${contactPlaceholders})`
      )
      .get(todayStart, ...CONTACT_STATUSES) as { n: number }
  ).n;

  const demosSetToday = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) AS n FROM activity_log
         WHERE created_at >= ? AND meta = 'demo_scheduled'`
      )
      .get(todayStart) as { n: number }
  ).n;

  const demosClosedToday = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) AS n FROM activity_log
         WHERE created_at >= ? AND meta = 'closed_won'`
      )
      .get(todayStart) as { n: number }
  ).n;

  const totalDoors = (db.prepare('SELECT COUNT(*) AS n FROM leads').get() as { n: number }).n;

  const everDemo = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT lead_id) AS n FROM activity_log WHERE meta = 'demo_scheduled'`
      )
      .get() as { n: number }
  ).n;

  const closedWon = (
    db.prepare(`SELECT COUNT(*) AS n FROM leads WHERE status = 'closed_won'`).get() as {
      n: number;
    }
  ).n;

  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS n FROM leads GROUP BY status')
    .all() as Array<{ status: string; n: number }>;

  res.json({
    today: {
      doors_knocked: doorsToday,
      contacted: contactedToday,
      demos_set: demosSetToday,
      demos_closed: demosClosedToday,
    },
    conversion: {
      doors_to_demo: totalDoors ? everDemo / totalDoors : 0,
      demo_to_close: everDemo ? closedWon / everDemo : 0,
    },
    totals: {
      doors: totalDoors,
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    },
  });
});
