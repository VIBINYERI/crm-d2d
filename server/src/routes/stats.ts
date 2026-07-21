import { Router } from 'express';
import { one, q } from '../db.js';
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

statsRouter.get('/', async (_req, res) => {
  const todayStart = startOfTodayISO();

  const count = async (sql: string, params: unknown[] = []) =>
    (await one<{ n: number }>(sql, params))!.n;

  const doorsToday = await count(
    `SELECT COUNT(*)::int AS n FROM activity_log WHERE type = 'created' AND created_at >= $1`,
    [todayStart]
  );

  const contactPlaceholders = CONTACT_STATUSES.map((_, i) => `$${i + 2}`).join(', ');
  const contactedToday = await count(
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM activity_log
     WHERE created_at >= $1 AND meta IN (${contactPlaceholders})`,
    [todayStart, ...CONTACT_STATUSES]
  );

  const demosSetToday = await count(
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM activity_log
     WHERE created_at >= $1 AND meta = 'demo_scheduled'`,
    [todayStart]
  );

  const demosClosedToday = await count(
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM activity_log
     WHERE created_at >= $1 AND meta = 'closed_won'`,
    [todayStart]
  );

  const totalDoors = await count('SELECT COUNT(*)::int AS n FROM leads');

  const everDemo = await count(
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM activity_log WHERE meta = 'demo_scheduled'`
  );

  const closedWon = await count(`SELECT COUNT(*)::int AS n FROM leads WHERE status = 'closed_won'`);

  const byStatus = await q<{ status: string; n: number }>(
    'SELECT status, COUNT(*)::int AS n FROM leads GROUP BY status'
  );

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
