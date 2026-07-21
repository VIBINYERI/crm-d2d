# D2D CRM — Window Detailing

A mobile-first door-to-door sales CRM for a residential window detailing business
(Downers Grove & Lombard, IL), with real Google Calendar integration for demo
appointments.

## Features

- **Doors/Leads** — every house you knock is a record: address (auto-geocoded),
  status pipeline (`Not Home → Contacted → Interested → Demo Scheduled → Demo
  Complete → Closed Won / Closed Lost / Callback Later`), homeowner contact info,
  notes, source tag (D2D / Referral / Callback), follow-up date, and a
  timestamped activity log that auto-appends on every status change.
- **Quick-add flow** — under 3 taps from a porch: open **+**, type the street,
  tap **Not Home / Contacted / Interested**. Saved. The form resets for the next
  door.
- **Google Calendar scheduling** — setting a lead to *Demo Scheduled* opens a
  scheduling panel (date, time, duration). Saving creates a **real event on your
  Google Calendar** titled `Window Demo - [Homeowner / Address]` with the
  address, phone, notes, and a link back to the CRM record in the description.
  Rescheduling updates the event; cancelling (or moving the lead off *Demo
  Scheduled*) deletes it. The event ID is stored on the lead.
- **Week view** — pulls this week's events live from Google Calendar (read-only)
  so demos show alongside everything else. Falls back to CRM-scheduled demos if
  Google isn't connected yet.
- **Territory map** — Leaflet map with pins color-coded by status, filterable by
  city (Downers Grove / Lombard), street, and status for route planning.
- **Dashboard** — today's doors knocked / contacted / demos set / demos closed,
  all-time doors→demo and demo→close conversion rates, and this week's demos.
- **Multi-rep ready** — leads carry an `assigned_rep_id`; a `reps` table and API
  exist so more reps can be added later.

## Stack

| Piece    | Tech                                              |
| -------- | ------------------------------------------------- |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4    |
| Backend  | Node + Express (TypeScript, run with `tsx`)       |
| Database | SQLite via `better-sqlite3` (file: `server/data/crm.db`) |
| Map      | Leaflet + OpenStreetMap tiles                     |
| Geocoding| OpenStreetMap Nominatim (free, no key)            |
| Calendar | Google Calendar REST API + OAuth 2.0              |

## Project structure

```
crm-d2d/
├── package.json          # npm workspaces root (npm run dev starts both apps)
├── server/
│   ├── .env.example      # copy to .env and fill in
│   └── src/
│       ├── index.ts      # Express app
│       ├── db.ts         # SQLite schema + helpers
│       ├── seed.ts       # sample leads (auto-seeds an empty DB)
│       ├── statuses.ts   # pipeline definition
│       ├── routes/       # leads, auth, calendar, stats, reps
│       └── services/     # google (OAuth + Calendar), geocode, calendarSync
└── client/
    └── src/
        ├── pages/        # Dashboard, Doors, LeadDetail, QuickAdd, MapView, Week, Settings
        ├── components/   # StatusBadge, SchedulePanel, PageHeader
        ├── api.ts        # typed API client
        └── statusMeta.ts # status labels/colors shared across views
```

## Setup

```bash
git clone <this repo>
cd crm-d2d
npm install                     # installs server + client (workspaces)
cp server/.env.example server/.env
npm run dev                     # server on :4000, client on :5173
```

Open http://localhost:5173 — the database is created and seeded with 8 sample
leads on first run. On your phone, open `http://<your-computer's-LAN-IP>:5173`
(the Vite dev server listens on all interfaces).

Everything works without Google credentials except calendar sync — demos are
then saved in the CRM only, and the Week view shows CRM demos instead of your
full calendar.

## Google Calendar API credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create a project (e.g. "d2d-crm").
2. **Enable the API**: APIs & Services → Library → search "Google Calendar API"
   → Enable.
3. **OAuth consent screen**: APIs & Services → OAuth consent screen → External →
   fill in app name + your email. Add yourself under **Test users** (while the
   app is in "Testing" mode only test users can sign in — that's fine for
   personal use).
4. **Scopes**: add `.../auth/calendar.events` and `.../auth/userinfo.email`
   (or skip — scopes are requested at sign-in anyway).
5. **Credentials**: APIs & Services → Credentials → Create Credentials → OAuth
   client ID → type **Web application**:
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** into `server/.env`:

   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
   ```

7. Restart the server, open the app → **Settings (⚙️) → Connect Google
   Calendar**, and approve. You authenticate once; the refresh token is stored
   in SQLite (server-side only, never sent to the browser) and access tokens
   are refreshed automatically. Google's "unverified app" warning is expected
   in Testing mode — click *Continue*.

> **Note on tokens**: OAuth tokens live in the `google_auth` table of
> `server/data/crm.db`. Keep that file (and `.env`) out of version control —
> both are already in `.gitignore`.

## Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run dev`          | Run server (:4000) + client (:5173)       |
| `npm run build`        | Type-check + build both apps              |
| `npm run seed`         | Seed sample data into an empty DB         |
| `npm start`            | Run the compiled server (`server/dist`)   |

## API overview

- `GET/POST /api/leads`, `GET/PATCH/DELETE /api/leads/:id`
- `POST /api/leads/:id/schedule` `{ start: "YYYY-MM-DDTHH:mm", duration_min }` —
  creates/updates the Google Calendar event
- `DELETE /api/leads/:id/schedule?next_status=callback_later` — cancels the demo
  and deletes the calendar event
- `GET /api/calendar/week?offset=0` — this week's events (live from Google)
- `GET /api/stats` — daily counters + conversion rates
- `GET /api/auth/google` → OAuth flow → `GET /api/auth/google/status`
- `GET/POST /api/reps`
