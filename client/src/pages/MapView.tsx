import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import { STATUS_META, STATUS_ORDER } from '../statusMeta';
import type { Lead, LeadStatus } from '../types';

// Centered between Downers Grove and Lombard
const DEFAULT_CENTER: [number, number] = [41.843, -88.008];

export default function MapView() {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');

  useEffect(() => {
    api.listLeads().then(setLeads);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  const filtered = leads.filter((lead) => {
    if (city && lead.city !== city) return false;
    if (statusFilter && lead.status !== statusFilter) return false;
    if (q && !lead.street.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    const markers = markersRef.current;
    const map = mapRef.current;
    if (!markers || !map) return;
    markers.clearLayers();
    const points: [number, number][] = [];
    for (const lead of filtered) {
      if (lead.lat == null || lead.lng == null) continue;
      points.push([lead.lat, lead.lng]);
      const meta = STATUS_META[lead.status];
      const marker = L.circleMarker([lead.lat, lead.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: meta.color,
        fillOpacity: 0.95,
      });
      marker.bindTooltip(`${lead.street} — ${meta.label}`);
      marker.on('click', () => navigate(`/doors/${lead.id}`));
      markers.addLayer(marker);
    }
    if (points.length) {
      map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, city, q, statusFilter]);

  const unmapped = filtered.filter((l) => l.lat == null || l.lng == null).length;

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col">
      <PageHeader title="Territory map" subtitle={`${filtered.length} doors shown`} />

      <div className="space-y-2 border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex gap-2">
          {['', 'Downers Grove', 'Lombard'].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCity(c)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold ${
                city === c ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-600'
              }`}
            >
              {c || 'Both cities'}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Filter by street…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter('')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === ''
                ? 'bg-slate-800 text-white'
                : 'border border-slate-300 bg-white text-slate-600'
            }`}
          >
            All
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === s ? 'text-white' : 'border border-slate-300 bg-white text-slate-600'
              }`}
              style={statusFilter === s ? { backgroundColor: STATUS_META[s].color } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusFilter === s ? '#fff' : STATUS_META[s].color }}
              />
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1" />
      {unmapped > 0 && (
        <p className="bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-700">
          {unmapped} door{unmapped > 1 ? 's' : ''} without map coordinates (geocoding failed)
        </p>
      )}
    </div>
  );
}
