import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import type { GoogleStatus } from '../types';

export default function Settings() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [searchParams] = useSearchParams();
  const flash = searchParams.get('google');

  const load = () => api.googleStatus().then(setStatus).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const disconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Existing events stay on your calendar.')) return;
    await api.googleDisconnect();
    load();
  };

  return (
    <div>
      <PageHeader title="Settings" back="/" />
      <div className="space-y-4 p-4">
        {flash === 'connected' && (
          <div className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
            ✓ Google Calendar connected
          </div>
        )}
        {flash === 'error' && (
          <div className="rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700">
            Google connection failed — try again.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Google Calendar</h2>
          <p className="mb-4 text-sm text-slate-500">
            Demo appointments are created directly on your Google Calendar, and the Week view reads
            from it live.
          </p>

          {!status ? (
            <p className="text-sm text-slate-400">Checking…</p>
          ) : !status.configured ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              OAuth credentials are not set up yet. Add <code>GOOGLE_CLIENT_ID</code> and{' '}
              <code>GOOGLE_CLIENT_SECRET</code> to <code>server/.env</code> — see the README for
              step-by-step instructions.
            </div>
          ) : status.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700">
                ● Connected{status.email ? ` as ${status.email}` : ''}
              </p>
              <button
                onClick={disconnect}
                className="w-full rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-600"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              className="block rounded-xl bg-blue-700 py-3 text-center font-semibold text-white"
            >
              Connect Google Calendar
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">About</h2>
          <p className="text-sm text-slate-500">
            D2D CRM for residential window detailing — Downers Grove &amp; Lombard, IL. Data lives
            in a local SQLite database on the server.
          </p>
        </div>
      </div>
    </div>
  );
}
