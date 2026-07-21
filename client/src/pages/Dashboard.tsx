import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import { formatDateTime } from '../statusMeta';
import type { Stats, WeekResponse } from '../types';

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [weekError, setWeekError] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api
      .getWeek()
      .then(setWeek)
      .catch(() => setWeekError(true));
  }, []);

  const counters = [
    { label: 'Doors knocked', value: stats?.today.doors_knocked, color: 'text-slate-900' },
    { label: 'Contacted', value: stats?.today.contacted, color: 'text-sky-700' },
    { label: 'Demos set', value: stats?.today.demos_set, color: 'text-violet-700' },
    { label: 'Demos closed', value: stats?.today.demos_closed, color: 'text-emerald-700' },
  ];

  const upcomingDemos = (week?.events ?? []).filter((e) => e.isDemo);

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        action={
          <Link
            to="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg active:bg-slate-100"
            aria-label="Settings"
          >
            ⚙️
          </Link>
        }
      />

      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          {counters.map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`text-3xl font-bold ${c.color}`}>{c.value ?? '—'}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Conversion (all time)</h2>
          <div className="flex divide-x divide-slate-200">
            <div className="flex-1 pr-4">
              <div className="text-2xl font-bold text-slate-900">
                {stats ? pct(stats.conversion.doors_to_demo) : '—'}
              </div>
              <div className="text-xs text-slate-500">Doors → Demo</div>
            </div>
            <div className="flex-1 pl-4">
              <div className="text-2xl font-bold text-slate-900">
                {stats ? pct(stats.conversion.demo_to_close) : '—'}
              </div>
              <div className="text-xs text-slate-500">Demo → Close</div>
            </div>
          </div>
          {stats && (
            <p className="mt-3 text-xs text-slate-400">{stats.totals.doors} doors total</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">This week's demos</h2>
            <Link to="/week" className="text-xs font-medium text-blue-700">
              Full week ›
            </Link>
          </div>
          {weekError ? (
            <p className="text-sm text-slate-500">Couldn't load calendar.</p>
          ) : !week ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : upcomingDemos.length === 0 ? (
            <p className="text-sm text-slate-500">
              No demos scheduled this week.{' '}
              {!week.connected && (
                <Link to="/settings" className="text-blue-700 underline">
                  Connect Google Calendar
                </Link>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingDemos.map((e) => (
                <li key={e.id} className="py-2.5">
                  {e.leadId ? (
                    <Link to={`/doors/${e.leadId}`} className="block">
                      <div className="text-sm font-medium text-slate-900">{e.summary}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(e.start)}</div>
                    </Link>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-slate-900">{e.summary}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(e.start)}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          to="/add"
          className="block rounded-2xl bg-blue-700 py-4 text-center text-lg font-bold text-white shadow"
        >
          + Add a door
        </Link>
      </div>
    </div>
  );
}
