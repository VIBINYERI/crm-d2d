import { STATUS_LABELS, type LeadStatus } from './statuses.js';

type RawQuery = (text: string, params?: unknown[]) => Promise<unknown[]>;

interface SeedLead {
  street: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  status: LeadStatus;
  homeowner_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  source?: string;
}

// Sample doors in Downers Grove and Lombard, IL — pre-geocoded so the map
// works even without network access.
const SAMPLE_LEADS: SeedLead[] = [
  {
    street: '4917 Main St',
    city: 'Downers Grove',
    zip: '60515',
    lat: 41.8081,
    lng: -88.0112,
    status: 'interested',
    homeowner_name: 'Sarah Mitchell',
    phone: '(630) 555-0142',
    notes: 'Big bay windows in front, water spots visible. Wants a quote for full exterior.',
  },
  {
    street: '5215 Fairview Ave',
    city: 'Downers Grove',
    zip: '60515',
    lat: 41.8035,
    lng: -88.0031,
    status: 'demo_scheduled',
    homeowner_name: 'Tom Baker',
    phone: '(630) 555-0187',
    email: 'tbaker@example.com',
    notes: 'Two-story colonial. Interested in the ceramic coating upsell.',
  },
  {
    street: '820 Maple Ave',
    city: 'Downers Grove',
    zip: '60515',
    lat: 41.7955,
    lng: -88.0189,
    status: 'not_home',
    notes: 'Nice landscaping, likely owner-occupied. Try after 5pm.',
  },
  {
    street: '1124 Prairie Ave',
    city: 'Downers Grove',
    zip: '60515',
    lat: 41.8102,
    lng: -88.0205,
    status: 'callback_later',
    homeowner_name: 'Linda Garza',
    phone: '(630) 555-0119',
    notes: 'Asked to come back after the 4th of July weekend.',
    source: 'callback',
  },
  {
    street: '336 W Maple St',
    city: 'Lombard',
    zip: '60148',
    lat: 41.8794,
    lng: -88.0143,
    status: 'contacted',
    homeowner_name: 'Dave Okafor',
    notes: 'Talked briefly, on his way out. Left a flyer.',
  },
  {
    street: '511 S Main St',
    city: 'Lombard',
    zip: '60148',
    lat: 41.8721,
    lng: -88.0079,
    status: 'closed_won',
    homeowner_name: 'Priya Natarajan',
    phone: '(630) 555-0163',
    email: 'priya.n@example.com',
    notes: 'Full house detail, $340. Referred her neighbor on Madison St!',
  },
  {
    street: '224 E Madison St',
    city: 'Lombard',
    zip: '60148',
    lat: 41.8768,
    lng: -88.0021,
    status: 'interested',
    homeowner_name: 'Greg Whitfield',
    phone: '(630) 555-0171',
    notes: "Priya's neighbor. Wants demo on the sunroom windows.",
    source: 'referral',
  },
  {
    street: '947 S Westmore Meyers Rd',
    city: 'Lombard',
    zip: '60148',
    lat: 41.8652,
    lng: -87.9968,
    status: 'closed_lost',
    homeowner_name: 'Bill Hansen',
    notes: 'Went with a national franchise. Check back next season.',
  },
];

export async function seedIfEmpty(query: RawQuery): Promise<void> {
  const reps = (await query('SELECT COUNT(*)::int AS n FROM reps')) as Array<{ n: number }>;
  if (reps[0].n === 0) {
    await query('INSERT INTO reps (name, email) VALUES ($1, $2)', ['Me', null]);
  }

  const leads = (await query('SELECT COUNT(*)::int AS n FROM leads')) as Array<{ n: number }>;
  if (leads[0].n > 0) return;

  // A demo tomorrow at 10:00 for the demo_scheduled sample lead
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const demoStart = `${tomorrow.toISOString().slice(0, 10)}T10:00`;

  for (const lead of SAMPLE_LEADS) {
    const ts = new Date().toISOString();
    const isDemo = lead.status === 'demo_scheduled';
    const inserted = (await query(
      `INSERT INTO leads (street, city, zip, lat, lng, status, homeowner_name, phone, email,
                          notes, source, assigned_rep_id, demo_start, demo_duration_min,
                          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13, $14, $15)
       RETURNING id`,
      [
        lead.street,
        lead.city,
        lead.zip,
        lead.lat,
        lead.lng,
        lead.status,
        lead.homeowner_name ?? null,
        lead.phone ?? null,
        lead.email ?? null,
        lead.notes ?? '',
        lead.source ?? 'd2d',
        isDemo ? demoStart : null,
        isDemo ? 60 : null,
        ts,
        ts,
      ]
    )) as Array<{ id: number }>;
    const id = inserted[0].id;

    await query(
      'INSERT INTO activity_log (lead_id, type, meta, message, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, 'created', lead.status, `Door added — ${STATUS_LABELS[lead.status]}`, ts]
    );
    if (isDemo) {
      await query(
        'INSERT INTO activity_log (lead_id, type, meta, message, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, 'calendar', null, `Demo scheduled for ${demoStart.replace('T', ' ')} (60 min)`, ts]
      );
    }
  }
  console.log(`Seeded ${SAMPLE_LEADS.length} sample leads.`);
}
