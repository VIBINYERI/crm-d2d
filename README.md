# D2D CRM — Window Detailing

A mobile-first door-to-door sales CRM for a residential window detailing business
(Downers Grove & Lombard, IL), with real Google Calendar integration for demo
appointments. Built to deploy on **Vercel** (frontend + serverless API + Neon
Postgres) and to run locally with zero configuration.

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
- **Territory map** — Google Map (satellite/hybrid by default so you can see
  actual rooftops) with pins color-coded by status, filterable by city
  (Downers Grove / Lombard), street, and status. **Tap any house** to
  reverse-geocode its address and save it as a new door with one more tap
  (Not Home / Contacted / Interested); tap an existing pin for a quick card
  with a jump into the record.
- **Dashboard** — today's doors knocked / contacted / demos set / demos closed,
  all-time doors→demo and demo→close conversion rates, and this week's demos.
- **Multi-rep ready** — leads carry an `assigned_rep_id`; a `reps` table and API
  exist so more reps can be added later.

## Stack

| Piece    | Tech                                                    |
| -------- | ------------------------------------------------------- |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4          |
| Backend  | Express (TypeScript) — local server *or* one Vercel serverless function |
| Database | Postgres — Neon on Vercel; embedded PGlite for local dev |
| Map      | Google Maps JavaScript API (satellite + tap-to-add)     |
| Geocoding| Google (map taps) + OpenStreetMap Nominatim (typed addresses) |
| Calendar | Google Calendar REST API + OAuth 2.0                    |

## Project structure

```
crm-d2d/
├── package.json          # npm workspaces root (npm run dev starts both apps)
├── vercel.json           # Vercel build + rewrites (SPA fallback, /api → function)
├── api/index.js          # Vercel serverless entry — wraps the Express app
├── server/
│   ├── .env.example      # copy to .env for local dev
│   └── src/
│       ├── app.ts        # Express app (shared by local server + Vercel function)
│       ├── index.ts      # local dev entry (app.listen)
│       ├── db.ts         # Postgres pool / PGlite + schema + lazy init
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

## Run locally

```bash
git clone <this repo>
cd crm-d2d
npm install                     # installs server + client (workspaces)
cp server/.env.example server/.env
npm run dev                     # server on :4000, client on :5173
```

Open http://localhost:5173 — with no `DATABASE_URL` set, an embedded Postgres
(PGlite) is created at `server/data/pg` and seeded with 8 sample leads
automatically. On your phone, open `http://<your-computer's-LAN-IP>:5173`.

## Deploy to Vercel

1. **Import the repo** at [vercel.com/new](https://vercel.com/new). The included
   `vercel.json` handles everything — keep Root Directory as the repo root and
   don't override build settings. The frontend deploys as a static site and the
   Express API runs as a serverless function under `/api`.
2. **Add a database** (required — without it, data resets between requests):
   in your Vercel project go to **Storage → Create Database → Neon (Postgres)**
   → connect it to the project. This injects `DATABASE_URL` automatically.
   Redeploy after connecting.
3. **Add Google credentials** (for calendar sync): in **Settings → Environment
   Variables** add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (setup below).
   `APP_URL` and the OAuth redirect URI are derived from your Vercel production
   domain automatically; set them explicitly only if you use a custom domain.
4. **Add the map key**: also in Environment Variables, add
   `VITE_GOOGLE_MAPS_API_KEY` (setup below). It's baked into the frontend at
   build time, so **redeploy after adding it**.
5. Open the deployed app → **⚙️ Settings → Connect Google Calendar**.

The database schema is created and sample data seeded automatically on the
first request.

## Google Maps API key (territory map)

In the same Google Cloud project as the calendar credentials:

1. **Enable two APIs**: APIs & Services → Library → enable **Maps JavaScript
   API** and **Geocoding API**.
2. **Create a key**: Credentials → Create Credentials → **API key**.
3. Recommended: restrict the key (Application restrictions → Websites) to
   `https://<your-app>.vercel.app/*` and `http://localhost:5173/*`, and limit
   it to the two APIs above.
4. Set it as `VITE_GOOGLE_MAPS_API_KEY` — in Vercel's Environment Variables
   (then redeploy), and in `client/.env.local` for local dev (copy
   `client/.env.example`).

Google's free monthly credit comfortably covers personal use.

## Google Calendar API credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create a project (e.g. "d2d-crm").
2. **Enable the API**: APIs & Services → Library → search "Google Calendar API"
   → Enable.
3. **OAuth consent screen**: APIs & Services → OAuth consent screen → External →
   fill in app name + your email. Add yourself under **Test users** (while the
   app is in "Testing" mode only test users can sign in — that's fine for
   personal use).
4. **Credentials**: APIs & Services → Credentials → Create Credentials → OAuth
   client ID → type **Web application**. Add BOTH redirect URIs:
   - `https://<your-app>.vercel.app/api/auth/google/callback` (production)
   - `http://localhost:4000/api/auth/google/callback` (local dev)
5. Copy the **Client ID** and **Client Secret** into the Vercel environment
   variables (and into `server/.env` for local dev):

   ```env
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   ```

6. Redeploy (or restart the local server), open the app → **Settings (⚙️) →
   Connect Google Calendar**, and approve. You authenticate once; the refresh
   token is stored in the database (server-side only, never sent to the
   browser) and access tokens are refreshed automatically. Google's
   "unverified app" warning is expected in Testing mode — click *Continue*.

## Scripts

| Command                | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Run server (:4000) + client (:5173) locally      |
| `npm run build`        | Type-check + build both apps (also used by Vercel) |
| `npm start`            | Run the compiled server (`server/dist`) locally  |

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
