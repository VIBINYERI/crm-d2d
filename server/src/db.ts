import fs from 'node:fs';
import { env } from './env.js';
import { seedIfEmpty } from './seed.js';

interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

let client: Queryable | null = null;
let ready: Promise<void> | null = null;

async function createClient(): Promise<Queryable> {
  if (env.databaseUrl) {
    const { default: pg } = await import('pg');
    const isLocal = /localhost|127\.0\.0\.1/.test(env.databaseUrl);
    return new pg.Pool({
      connectionString: env.databaseUrl,
      max: 3,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }

  if (env.isVercel) {
    // Data written here evaporates between invocations — the app "works" but
    // nothing persists. Make the misconfiguration impossible to miss.
    console.error(
      'DATABASE_URL is not set on Vercel — data will NOT persist. ' +
        'Create a Postgres database in the Vercel dashboard (Storage tab) and redeploy.'
    );
  }

  // Zero-config local development: embedded Postgres persisted to ./data/pg
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = env.isVercel ? '/tmp/crm-pg' : './data/pg';
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  return {
    query: async (text, params) => db.query(text, params as never),
  };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reps (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    zip TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
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
    id SERIAL PRIMARY KEY,
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
    expiry_ms BIGINT,
    account_email TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_activity_lead ON activity_log(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`;

// Lazily connect, create the schema, and seed on the first query. Serverless
// invocations share this via module scope while the instance stays warm.
export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const c = await createClient();
      // One statement per call — PGlite's extended query protocol rejects
      // multi-statement strings.
      for (const stmt of SCHEMA.split(';')) {
        if (stmt.trim()) await c.query(stmt);
      }
      // Seed with the raw client — helpers like q() await ensureReady() and
      // would deadlock against this very promise.
      await seedIfEmpty((text, params) => c.query(text, params).then((r) => r.rows));
      client = c;
    })().catch((err) => {
      // Allow a retry on the next request instead of caching the failure
      ready = null;
      client = null;
      throw err;
    });
  }
  return ready;
}

async function getClient(): Promise<Queryable> {
  await ensureReady();
  return client!;
}

export async function q<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = await getClient();
  const result = await c.query(text, params);
  return result.rows as T[];
}

export async function one<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}

export async function run(text: string, params: unknown[] = []): Promise<void> {
  const c = await getClient();
  await c.query(text, params);
}

export const now = () => new Date().toISOString();

export async function logActivity(
  leadId: number,
  type: string,
  message: string,
  meta?: string
): Promise<void> {
  await run(
    'INSERT INTO activity_log (lead_id, type, meta, message, created_at) VALUES ($1, $2, $3, $4, $5)',
    [leadId, type, meta ?? null, message, now()]
  );
}
