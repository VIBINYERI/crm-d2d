import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

const dbDir = path.dirname(env.dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(env.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS reps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT,
    lat REAL,
    lng REAL,
    status TEXT NOT NULL DEFAULT 'not_home',
    homeowner_name TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'd2d',
    assigned_rep_id INTEGER REFERENCES reps(id),
    follow_up_at TEXT,
    demo_start TEXT,
    demo_duration_min INTEGER,
    gcal_event_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    meta TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS google_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_ms INTEGER,
    account_email TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`);

export const now = () => new Date().toISOString();

export function logActivity(leadId: number, type: string, message: string, meta?: string) {
  db.prepare(
    'INSERT INTO activity_log (lead_id, type, meta, message, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(leadId, type, meta ?? null, message, now());
}
