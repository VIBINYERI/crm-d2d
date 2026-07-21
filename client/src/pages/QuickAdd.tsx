import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import type { LeadSource, LeadStatus } from '../types';

const CITIES = [
  { name: 'Downers Grove', zip: '60515' },
  { name: 'Lombard', zip: '60148' },
];

// One-tap outcomes for the porch flow: type the street, tap the outcome, done.
const QUICK_STATUSES: { status: LeadStatus; label: string; className: string }[] = [
  { status: 'not_home', label: 'Not Home', className: 'bg-slate-600' },
  { status: 'contacted', label: 'Contacted', className: 'bg-sky-600' },
  { status: 'interested', label: 'Interested', className: 'bg-amber-500' },
];

export default function QuickAdd() {
  const navigate = useNavigate();
  const [street, setStreet] = useState('');
  const [city, setCity] = useState(CITIES[0]);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<LeadSource>('d2d');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const save = async (status: LeadStatus, goToDetail = false) => {
    if (!street.trim()) {
      setError('Enter the street address first');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await api.createLead({
        street: street.trim(),
        city: city.name,
        zip: city.zip,
        status,
        homeowner_name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        source,
      });
      if (goToDetail) {
        navigate(`/doors/${lead.id}`);
        return;
      }
      // Stay on the page ready for the next door
      setStreet('');
      setName('');
      setPhone('');
      setNotes('');
      setSavedMsg(`Saved: ${lead.street} — ${status.replace(/_/g, ' ')}`);
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Add a door" subtitle="Type the street, tap the outcome" />
      <div className="space-y-4 p-4">
        <input
          type="text"
          inputMode="text"
          autoFocus
          placeholder="Street address (e.g. 4917 Main St)"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-lg shadow-sm"
        />

        <div className="flex gap-2">
          {CITIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setCity(c)}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
                city.name === c.name
                  ? 'bg-blue-700 text-white'
                  : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_STATUSES.map((q) => (
            <button
              key={q.status}
              onClick={() => save(q.status)}
              disabled={saving}
              className={`rounded-2xl py-5 text-sm font-bold text-white shadow disabled:opacity-50 ${q.className}`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {savedMsg && (
          <div className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
            ✓ {savedMsg}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={() => setShowMore(!showMore)}
          className="w-full py-2 text-sm font-medium text-blue-700"
        >
          {showMore ? 'Hide details' : 'More details (name, phone, notes)…'}
        </button>

        {showMore && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Homeowner name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            />
            <textarea
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            />
            <div className="flex gap-2">
              {(['d2d', 'referral', 'callback'] as LeadSource[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${
                    source === s
                      ? 'bg-slate-800 text-white'
                      : 'border border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {s === 'd2d' ? 'D2D' : s}
                </button>
              ))}
            </div>
            <button
              onClick={() => save('interested', true)}
              disabled={saving}
              className="w-full rounded-xl border border-blue-700 py-3 font-semibold text-blue-700 disabled:opacity-50"
            >
              Save + open full record
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
