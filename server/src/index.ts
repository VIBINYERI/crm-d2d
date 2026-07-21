import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { leadsRouter } from './routes/leads.js';
import { authRouter } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { statsRouter } from './routes/stats.js';
import { repsRouter } from './routes/reps.js';
import { seedIfEmpty } from './seed.js';

seedIfEmpty();

const app = express();
app.use(cors({ origin: env.appUrl }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/leads', leadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/stats', statsRouter);
app.use('/api/reps', repsRouter);

app.listen(env.port, () => {
  console.log(`CRM server listening on http://localhost:${env.port}`);
});
