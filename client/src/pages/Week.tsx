import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import type { WeekResponse } from '../types';

function dayKey(iso: string): string {
  const d = new Date(iso.length === 16 ? `${iso}:00` : iso);
  return d.toDateString();
}

function timeLabel(iso: string): string {
  const d = new Date(iso.length === 16 ? `${iso}:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  // All-day events come through as bare dates
  if (iso.length === 10) return 'All day';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function Week() {
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getWeek(offset)
      .then(setWeek)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [offset]);

  const byDay = new Map<string, NonNullable<typeof week>['events']>();
  for (const event of week?.events ?? []) {
    const key = dayKey(event.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(event);
  }

  const weekLabel = week
    ? new Date(week.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';

  return (
    <div>
      <PageHeader
        title="This week"
        subtitle={
          week
            ? week.connected
              ? 'Live from Google Calendar'
              : 'CRM demos only — Google Calendar not connected'
            : undefined
        }
        action={
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setOffset(offset - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg active:bg-slate-100"
            >
              ‹
            </button>
            <span className="min-w-16 text-center text-xs font-medium text-slate-600">
              {offset === 0 ? 'This wk' : `Wk of ${weekLabel}`}
            </span>
            <button
              onClick={() => setOffset(offset + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg active:bg-slate-100"
            >
              ›
            </button>
          </div>
        }
      />

      <div className="p-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !week || week.events.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">Nothing on the calendar this week.</p>
            {week && !week.connected && (
              <Link to="/settings" className="mt-2 inline-block text-sm text-blue-700 underline">
                Connect Google Calendar to see everything
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {[...byDay.entries()].map(([day, events]) => (
              <div key={day}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {new Date(day).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h2>
                <ul className="space-y-2">
                  {events.map((e) => {
                    const card = (
                      <div
                        className={`rounded-2xl border p-3 shadow-sm ${
                          e.isDemo
                            ? 'border-violet-200 bg-violet-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className={`truncate text-sm font-semibold ${
                                e.isDemo ? 'text-violet-900' : 'text-slate-800'
                              }`}
                            >
                              {e.summary}
                            </div>
                            {e.location && (
                              <div className="truncate text-xs text-slate-500">{e.location}</div>
                            )}
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-600">
                            {timeLabel(e.start)}
                          </span>
                        </div>
                      </div>
                    );
                    return (
                      <li key={e.id}>
                        {e.leadId ? <Link to={`/doors/${e.leadId}`}>{card}</Link> : card}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
