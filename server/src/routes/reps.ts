import { Router } from 'express';
import { one, q } from '../db.js';

export const repsRouter = Router();

repsRouter.get('/', async (_req, res) => {
  res.json(await q('SELECT * FROM reps ORDER BY id'));
});

repsRouter.post('/', async (req, res) => {
  const { name, email } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const rep = await one('INSERT INTO reps (name, email) VALUES ($1, $2) RETURNING *', [
    name,
    email ?? null,
  ]);
  res.status(201).json(rep);
});
