import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { STATUS_META, STATUS_ORDER, formatDateTime } from '../statusMeta';
import type { Lead, LeadStatus } from '../types';

export default function Doors() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .listLeads({ q: q || undefined, status: status || undefined, city: city || undefined })
        .then(setLeads)
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, status, city]);

  return (
    <div>
      <PageHeader title="Doors" subtitle={`${leads.length} shown`} />

      <div className="sticky top-[57px] z-30 space-y-2 border-b border-slate-200 bg-slate-50 p-3">
        <input
          type="search"
          placeholder="Search street, name, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['', 'Downers Grove', 'Lombard'].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCity(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                city === c ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {c || 'All cities'}
            </button>
          ))}
          <span className="mx-1 shrink-0 border-l border-slate-300" />
          <button
            onClick={() => setStatus('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              status === '' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-600'
            }`}
          >
            All statuses
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                status === s
                  ? 'text-white'
                  : `border border-slate-300 bg-white ${STATUS_META[s].text}`
              }`}
              style={status === s ? { backgroundColor: STATUS_META[s].color } : undefined}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {loading && leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No doors match. <Link to="/add" className="text-blue-700 underline">Add one</Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <Link
                  to={`/doors/${lead.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{lead.street}</div>
                      <div className="text-xs text-slate-500">
                        {lead.city}
                        {lead.homeowner_name ? ` · ${lead.homeowner_name}` : ''}
                      </div>
                    </div>
                    <StatusBadge status={lead.status} />
                  </div>
                  {lead.demo_start && (
                    <div className="mt-2 text-xs font-medium text-violet-700">
                      🗓 Demo {formatDateTime(lead.demo_start)}
                    </div>
                  )}
                  {lead.follow_up_at && !lead.demo_start && (
                    <div className="mt-2 text-xs font-medium text-orange-600">
                      ⏰ Follow up {formatDateTime(lead.follow_up_at)}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
