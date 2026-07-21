export type LeadStatus =
  | 'not_home'
  | 'contacted'
  | 'interested'
  | 'demo_scheduled'
  | 'demo_complete'
  | 'closed_won'
  | 'closed_lost'
  | 'callback_later';

export type LeadSource = 'd2d' | 'referral' | 'callback';

export interface ActivityEntry {
  id: number;
  lead_id: number;
  type: 'created' | 'status' | 'calendar';
  meta: string | null;
  message: string;
  created_at: string;
}

export interface Lead {
  id: number;
  street: string;
  city: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  status: LeadStatus;
  homeowner_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string;
  source: LeadSource;
  assigned_rep_id: number | null;
  follow_up_at: string | null;
  demo_start: string | null;
  demo_duration_min: number | null;
  gcal_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadWithActivity extends Lead {
  activity: ActivityEntry[];
  calendar_synced?: boolean;
  calendar_error?: string | null;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  location: string | null;
  start: string;
  end: string;
  isDemo: boolean;
  htmlLink: string | null;
  leadId: number | null;
}

export interface WeekResponse {
  connected: boolean;
  weekStart: string;
  events: CalendarEvent[];
}

export interface Stats {
  today: {
    doors_knocked: number;
    contacted: number;
    demos_set: number;
    demos_closed: number;
  };
  conversion: {
    doors_to_demo: number;
    demo_to_close: number;
  };
  totals: {
    doors: number;
    by_status: Partial<Record<LeadStatus, number>>;
  };
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}
