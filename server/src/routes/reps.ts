import { Router } from 'express';
import { db } from '../db.js';

export const repsRouter = Router();

repsRouter.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM reps ORDER BY id').all());
});

repsRouter.post('/', (req, res) => {
  const { name, email } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const result = db.prepare('INSERT INTO reps (name, email) VALUES (?, ?)').run(name, email ?? null);
  res.status(201).json(db.prepare('SELECT * FROM reps WHERE id = ?').get(result.lastInsertRowid));
});
