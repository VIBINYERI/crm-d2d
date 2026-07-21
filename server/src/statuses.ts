export const STATUSES = [
  'not_home',
  'contacted',
  'interested',
  'demo_scheduled',
  'demo_complete',
  'closed_won',
  'closed_lost',
  'callback_later',
] as const;

export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  not_home: 'Not Home',
  contacted: 'Contacted',
  interested: 'Interested',
  demo_scheduled: 'Demo Scheduled',
  demo_complete: 'Demo Complete',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  callback_later: 'Callback Later',
};

export const SOURCES = ['d2d', 'referral', 'callback'] as const;
export type LeadSource = (typeof SOURCES)[number];

// Statuses that mean "we actually talked to someone at the door"
export const CONTACT_STATUSES: LeadStatus[] = [
  'contacted',
  'interested',
  'demo_scheduled',
  'demo_complete',
  'closed_won',
  'closed_lost',
  'callback_later',
];
