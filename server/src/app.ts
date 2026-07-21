import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { ensureReady } from './db.js';
import { leadsRouter } from './routes/leads.js';
import { authRouter } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { statsRouter } from './routes/stats.js';
import { repsRouter } from './routes/reps.js';

export const app = express();

app.use(cors({ origin: env.appUrl }));
app.use(express.json());

// Connect + migrate + seed lazily on the first request (works both as a
// long-running server and as a Vercel serverless function).
app.use(async (_req, res, next) => {
  try {
    await ensureReady();
    next();
  } catch (err) {
    console.error('Database init failed:', err);
    res.status(500).json({ error: 'Database is not available' });
  }
});

// `persistent` tells the UI whether data actually survives: true locally
// (PGlite on disk) or when DATABASE_URL is set; false on Vercel without a
// connected database, where /tmp storage evaporates between invocations.
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, persistent: Boolean(env.databaseUrl) || !env.isVercel })
);
app.use('/api/leads', leadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/stats', statsRouter);
app.use('/api/reps', repsRouter);
