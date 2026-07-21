import type {
  GoogleStatus,
  Lead,
  LeadWithActivity,
  Stats,
  WeekResponse,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listLeads: (filters: { status?: string; city?: string; q?: string; source?: string } = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => Boolean(v)) as [string, string][]
    );
    const qs = params.toString();
    return request<Lead[]>(`/leads${qs ? `?${qs}` : ''}`);
  },
  getLead: (id: number | string) => request<LeadWithActivity>(`/leads/${id}`),
  createLead: (data: Partial<Lead>) =>
    request<LeadWithActivity>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<LeadWithActivity>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLead: (id: number) => request<{ ok: boolean }>(`/leads/${id}`, { method: 'DELETE' }),
  scheduleDemo: (id: number, start: string, durationMin: number) =>
    request<LeadWithActivity>(`/leads/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ start, duration_min: durationMin }),
    }),
  cancelDemo: (id: number, nextStatus = 'callback_later') =>
    request<LeadWithActivity>(`/leads/${id}/schedule?next_status=${nextStatus}`, {
      method: 'DELETE',
    }),
  getStats: () => request<Stats>('/stats'),
  getWeek: (offset = 0) => request<WeekResponse>(`/calendar/week?offset=${offset}`),
  getHealth: () => request<{ ok: boolean; persistent: boolean }>('/health'),
  googleStatus: () => request<GoogleStatus>('/auth/google/status'),
  googleDisconnect: () =>
    request<{ ok: boolean }>('/auth/google/disconnect', { method: 'POST' }),
};
