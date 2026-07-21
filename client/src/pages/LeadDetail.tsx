import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import SchedulePanel from '../components/SchedulePanel';
import StatusBadge from '../components/StatusBadge';
import { SOURCE_LABELS, STATUS_META, STATUS_ORDER, formatDateTime, fullAddress } from '../statusMeta';
import type { LeadStatus, LeadWithActivity } from '../types';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadWithActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    homeowner_name: '',
    phone: '',
    email: '',
    notes: '',
    follow_up_at: '',
  });

  useEffect(() => {
    if (!id) return;
    api
      .getLead(id)
      .then((l) => {
        setLead(l);
        setForm({
          homeowner_name: l.homeowner_name ?? '',
          phone: l.phone ?? '',
          email: l.email ?? '',
          notes: l.notes ?? '',
          follow_up_at: l.follow_up_at ?? '',
        });
      })
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div>
        <PageHeader title="Door" back="/doors" />
        <p className="p-4 text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!lead) {
    return (
      <div>
        <PageHeader title="Door" back="/doors" />
        <p className="p-4 text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const setStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;
    if (status === 'demo_scheduled') {
      // Demo Scheduled goes through the scheduling panel so a real calendar
      // event gets created.
      setShowSchedule(true);
      return;
    }
    try {
      setLead(await api.updateLead(lead.id, { status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const saveDetails = async () => {
    try {
      const updated = await api.updateLead(lead.id, {
        homeowner_name: form.homeowner_name || null,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes,
        follow_up_at: form.follow_up_at || null,
      });
      setLead(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const remove = async () => {
    if (!confirm('Delete this door? Its calendar event (if any) will also be removed.')) return;
    await api.deleteLead(lead.id);
    navigate('/doors');
  };

  const scheduleVisible = showSchedule || lead.status === 'demo_scheduled';

  return (
    <div>
      <PageHeader title={lead.street} subtitle={`${lead.city}${lead.zip ? ' ' + lead.zip : ''}`} back="/doors" />

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={lead.status} />
          <span className="text-xs text-slate-500">
            Source: {SOURCE_LABELS[lead.source]} · Added {formatDateTime(lead.created_at)}
          </span>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Set status
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                  lead.status === s ? 'text-white' : 'border border-slate-300 bg-white text-slate-600'
                }`}
                style={lead.status === s ? { backgroundColor: STATUS_META[s].color } : undefined}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {scheduleVisible && (
          <SchedulePanel lead={lead} onUpdated={setLead} onClose={() => setShowSchedule(false)} />
        )}
        {!scheduleVisible && (
          <button
            onClick={() => setShowSchedule(true)}
            className="w-full rounded-2xl border border-violet-300 bg-violet-50 py-3 font-semibold text-violet-700"
          >
            🗓 Schedule a demo
          </button>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Homeowner</h3>
            <button
              onClick={() => (editing ? saveDetails() : setEditing(true))}
              className="text-sm font-medium text-blue-700"
            >
              {editing ? 'Save' : 'Edit'}
            </button>
          </div>
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name"
                value={form.homeowner_name}
                onChange={(e) => setForm({ ...form, homeowner_name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <textarea
                placeholder="Notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Follow-up</span>
                <input
                  type="datetime-local"
                  value={form.follow_up_at}
                  onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          ) : (
            <dl className="space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-400">Name</dt>
                <dd className="text-slate-800">{lead.homeowner_name || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-400">Phone</dt>
                <dd className="text-slate-800">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-blue-700 underline">
                      {lead.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-400">Email</dt>
                <dd className="text-slate-800">{lead.email || '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-slate-400">Notes</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{lead.notes || '—'}</dd>
              </div>
              {lead.follow_up_at && (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-slate-400">Follow-up</dt>
                  <dd className="font-medium text-orange-600">
                    {formatDateTime(lead.follow_up_at)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            fullAddress(lead) + ', IL'
          )}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-2xl border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700"
        >
          🧭 Open in Google Maps
        </a>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Activity</h3>
          <ul className="space-y-3">
            {lead.activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                <div>
                  <p className="text-slate-800">{a.message}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button onClick={remove} className="w-full py-3 text-sm font-medium text-red-500">
          Delete this door
        </button>
      </div>
    </div>
  );
}
