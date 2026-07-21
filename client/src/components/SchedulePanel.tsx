import { useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../statusMeta';
import type { LeadWithActivity } from '../types';

const DURATIONS = [30, 45, 60, 90];

export default function SchedulePanel({
  lead,
  onUpdated,
  onClose,
}: {
  lead: LeadWithActivity;
  onUpdated: (lead: LeadWithActivity) => void;
  onClose?: () => void;
}) {
  const existingDate = lead.demo_start?.slice(0, 10) ?? '';
  const existingTime = lead.demo_start?.slice(11, 16) ?? '';
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [date, setDate] = useState(existingDate || tomorrow);
  const [time, setTime] = useState(existingTime || '10:00');
  const [duration, setDuration] = useState(lead.demo_duration_min ?? 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async () => {
    if (!date || !time) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.scheduleDemo(lead.id, `${date}T${time}`, duration);
      onUpdated(updated);
      if (updated.calendar_synced) {
        setNotice('Saved and synced to Google Calendar ✓');
      } else {
        setNotice(updated.calendar_error ?? 'Saved in CRM (calendar not synced)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel this demo? The Google Calendar event will be deleted.')) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.cancelDemo(lead.id);
      onUpdated(updated);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-violet-900">
          {lead.demo_start ? 'Demo appointment' : 'Schedule demo'}
        </h3>
        {lead.demo_start && (
          <span className="text-xs text-violet-700">
            {lead.gcal_event_id ? 'On Google Calendar' : 'CRM only'}
          </span>
        )}
      </div>

      {lead.demo_start && (
        <p className="mb-3 text-sm text-violet-800">
          Currently: <strong>{formatDateTime(lead.demo_start)}</strong> ·{' '}
          {lead.demo_duration_min ?? 60} min
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Duration</span>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                duration === d
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {d}m
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-violet-800">{notice}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl bg-violet-700 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : lead.demo_start ? 'Update appointment' : 'Schedule + add to Calendar'}
        </button>
        {lead.demo_start && (
          <button
            onClick={cancel}
            disabled={saving}
            className="rounded-xl border border-red-300 bg-white px-4 py-3 font-semibold text-red-600 disabled:opacity-50"
          >
            Cancel demo
          </button>
        )}
      </div>
    </div>
  );
}
