import { one, run } from '../db.js';
import { env, googleConfigured } from '../env.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expiry_ms: number | string | null;
  account_email: string | null;
}

function getTokens(): Promise<TokenRow | undefined> {
  return one<TokenRow>('SELECT * FROM google_auth WHERE id = 1');
}

async function saveTokens(t: {
  access_token: string;
  refresh_token?: string | null;
  expiry_ms: number;
  account_email?: string | null;
}): Promise<void> {
  const existing = await getTokens();
  await run(
    `INSERT INTO google_auth (id, access_token, refresh_token, expiry_ms, account_email)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expiry_ms = excluded.expiry_ms,
       account_email = excluded.account_email`,
    [
      t.access_token,
      t.refresh_token ?? existing?.refresh_token ?? null,
      t.expiry_ms,
      t.account_email ?? existing?.account_email ?? null,
    ]
  );
}

export async function isConnected(): Promise<boolean> {
  if (!googleConfigured()) return false;
  return Boolean((await getTokens())?.refresh_token);
}

export async function connectedEmail(): Promise<string | null> {
  return (await getTokens())?.account_email ?? null;
}

export async function disconnect(): Promise<void> {
  await run('DELETE FROM google_auth WHERE id = 1');
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    // Force the consent screen so Google always returns a refresh token,
    // even if the user connected before.
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  let email: string | null = null;
  try {
    const info = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (info.ok) email = ((await info.json()) as { email?: string }).email ?? null;
  } catch {
    // email is cosmetic — ignore failures
  }

  await saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_ms: Date.now() + data.expires_in * 1000,
    account_email: email,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    // A revoked refresh token means the user must reconnect.
    if (res.status === 400 || res.status === 401) await disconnect();
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await saveTokens({
    access_token: data.access_token,
    expiry_ms: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens?.refresh_token) throw new Error('Google Calendar is not connected');
  const expiry = Number(tokens.expiry_ms ?? 0);
  if (tokens.access_token && expiry > Date.now() + 60_000) {
    return tokens.access_token;
  }
  return refreshAccessToken(tokens.refresh_token);
}

async function calFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export interface EventInput {
  summary: string;
  description: string;
  location: string;
  startIso: string; // local wall-clock time, e.g. 2026-07-22T14:00:00
  endIso: string;
}

function eventBody(input: EventInput) {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startIso, timeZone: env.timezone },
    end: { dateTime: input.endIso, timeZone: env.timezone },
  };
}

export async function createEvent(input: EventInput): Promise<string> {
  const res = await calFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(eventBody(input)),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

export async function updateEvent(eventId: string, input: EventInput): Promise<void> {
  const res = await calFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(eventBody(input)),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status} ${await res.text()}`);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const res = await calFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
  // 404/410 = already gone in Google Calendar; that's fine.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to delete event: ${res.status} ${await res.text()}`);
  }
}

export interface CalendarEvent {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isDemo: boolean;
  htmlLink: string | null;
}

export async function listEvents(timeMinIso: string, timeMaxIso: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
  });
  const res = await calFetch(`/calendars/primary/events?${params}`);
  if (!res.ok) throw new Error(`Failed to list events: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      location?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };
  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? '(no title)',
    location: e.location ?? null,
    start: e.start?.dateTime ?? e.start?.date ?? '',
    end: e.end?.dateTime ?? e.end?.date ?? '',
    isDemo: (e.summary ?? '').startsWith('Window Demo'),
    htmlLink: e.htmlLink ?? null,
  }));
}
