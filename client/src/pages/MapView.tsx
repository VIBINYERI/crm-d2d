import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { STATUS_META, STATUS_ORDER } from '../statusMeta';
import type { Lead, LeadStatus } from '../types';

// Maps JS keys are public by design (they always ship in the browser bundle);
// abuse protection comes from the key's website restriction in Google Cloud,
// not secrecy. An env var still takes precedence if set.
const API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  'AIzaSyC8cnp7qoD7n-LslRBVCrqRq6YNDiQnY4o';

// Centered between Downers Grove and Lombard
const DEFAULT_CENTER = { lat: 41.843, lng: -88.008 };

const QUICK_STATUSES: { status: LeadStatus; label: string; className: string }[] = [
  { status: 'not_home', label: 'Not Home', className: 'bg-slate-600' },
  { status: 'contacted', label: 'Contacted', className: 'bg-sky-600' },
  { status: 'interested', label: 'Interested', className: 'bg-amber-500' },
];

type Selection =
  | { kind: 'lead'; leadId: number }
  | {
      kind: 'new';
      lat: number;
      lng: number;
      street: string;
      city: string;
      zip: string;
      resolving: boolean;
    };

function parseAddress(result: google.maps.GeocoderResult): {
  street: string;
  city: string;
  zip: string;
} {
  let streetNumber = '';
  let route = '';
  let city = '';
  let zip = '';
  for (const c of result.address_components) {
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('route')) route = c.short_name;
    if (c.types.includes('locality')) city = c.long_name;
    if (c.types.includes('postal_code')) zip = c.long_name;
  }
  return { street: [streetNumber, route].filter(Boolean).join(' '), city, zip };
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const tapMarkerRef = useRef<google.maps.Marker | null>(null);
  const didFitRef = useRef(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('hybrid');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listLeads().then(setLeads);
  }, []);

  const clearTapMarker = () => {
    tapMarkerRef.current?.setMap(null);
    tapMarkerRef.current = null;
  };

  const handleMapClick = useCallback((latLng: google.maps.LatLng) => {
    const lat = latLng.lat();
    const lng = latLng.lng();
    clearTapMarker();
    tapMarkerRef.current = new google.maps.Marker({
      map: mapRef.current!,
      position: { lat, lng },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#1d4ed8',
        fillOpacity: 0.4,
        strokeColor: '#1d4ed8',
        strokeWeight: 2,
      },
    });
    setSelection({ kind: 'new', lat, lng, street: '', city: '', zip: '', resolving: true });
    geocoderRef.current
      ?.geocode({ location: { lat, lng } })
      .then(({ results }) => {
        const parsed = results[0]
          ? parseAddress(results[0])
          : { street: '', city: '', zip: '' };
        setSelection((prev) =>
          prev?.kind === 'new' && prev.lat === lat && prev.lng === lng
            ? { ...prev, ...parsed, resolving: false }
            : prev
        );
      })
      .catch(() => {
        setSelection((prev) =>
          prev?.kind === 'new' && prev.lat === lat && prev.lng === lng
            ? { ...prev, resolving: false }
            : prev
        );
      });
  }, []);

  // Initialize Google Maps once
  useEffect(() => {
    if (!API_KEY || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    setOptions({ key: API_KEY, v: 'weekly' });
    Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('geocoding')])
      .then(([{ Map: GMap }, , { Geocoder }]) => {
        if (cancelled || !containerRef.current) return;
        const map = new GMap(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          mapTypeId: 'hybrid',
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          tilt: 0,
        });
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) handleMapClick(e.latLng);
        });
        mapRef.current = map;
        geocoderRef.current = new Geocoder();
        setMapReady(true);
      })
      .catch((err) => {
        console.error('Google Maps failed to load:', err);
        setMapError(
          'Google Maps failed to load — check that VITE_GOOGLE_MAPS_API_KEY is valid and the Maps JavaScript API is enabled.'
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleMapClick]);

  const filtered = leads.filter((lead) => {
    if (city && lead.city !== city) return false;
    if (statusFilter && lead.status !== statusFilter) return false;
    if (q && !lead.street.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Render pins whenever leads/filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    for (const lead of filtered) {
      if (lead.lat == null || lead.lng == null) continue;
      count += 1;
      bounds.extend({ lat: lead.lat, lng: lead.lng });
      const marker = new google.maps.Marker({
        map,
        position: { lat: lead.lat, lng: lead.lng },
        title: `${lead.street} — ${STATUS_META[lead.status].label}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: STATUS_META[lead.status].color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        clearTapMarker();
        setSelection({ kind: 'lead', leadId: lead.id });
      });
      markersRef.current.push(marker);
    }
    if (count > 0 && !didFitRef.current) {
      map.fitBounds(bounds, 48);
      didFitRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, city, q, statusFilter, mapReady]);

  const toggleMapType = () => {
    const next = mapType === 'hybrid' ? 'roadmap' : 'hybrid';
    setMapType(next);
    mapRef.current?.setMapTypeId(next);
  };

  const closeSheet = () => {
    clearTapMarker();
    setSelection(null);
  };

  const addDoor = async (status: LeadStatus) => {
    if (selection?.kind !== 'new') return;
    setSaving(true);
    try {
      const lead = await api.createLead({
        street: selection.street || `Pin near ${selection.lat.toFixed(5)}, ${selection.lng.toFixed(5)}`,
        city: selection.city || 'Downers Grove',
        zip: selection.zip || undefined,
        lat: selection.lat,
        lng: selection.lng,
        status,
      });
      setLeads((prev) => [lead, ...prev]);
      closeSheet();
    } finally {
      setSaving(false);
    }
  };

  const selectedLead =
    selection?.kind === 'lead' ? leads.find((l) => l.id === selection.leadId) : undefined;

  if (!API_KEY) {
    return (
      <div>
        <PageHeader title="Territory map" />
        <div className="p-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="mb-2 font-semibold">Google Maps needs an API key</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In Google Cloud Console, enable the Maps JavaScript API and Geocoding API</li>
              <li>Create an API key under Credentials</li>
              <li>
                Set <code className="rounded bg-amber-100 px-1">VITE_GOOGLE_MAPS_API_KEY</code> in
                Vercel (Environment Variables) and redeploy — or in{' '}
                <code className="rounded bg-amber-100 px-1">client/.env.local</code> for local dev
              </li>
            </ol>
            <p className="mt-2 text-amber-700">Full steps are in the README.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] flex-col">
      <PageHeader
        title="Territory map"
        subtitle={`${filtered.length} doors · tap a house to add it`}
        action={
          <button
            onClick={toggleMapType}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {mapType === 'hybrid' ? 'Map view' : 'Satellite'}
          </button>
        }
      />

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

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        {mapError && (
          <div className="absolute inset-x-3 top-3 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
            {mapError}
          </div>
        )}

        {selection && (
          <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <button
              onClick={closeSheet}
              className="absolute top-2 right-3 p-1 text-lg text-slate-400"
              aria-label="Close"
            >
              ✕
            </button>

            {selection.kind === 'new' ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  New door
                </p>
                {selection.resolving ? (
                  <p className="mt-1 text-sm text-slate-500">Looking up address…</p>
                ) : (
                  <div className="mt-1">
                    <input
                      type="text"
                      value={selection.street}
                      placeholder="Street address"
                      onChange={(e) =>
                        setSelection({ ...selection, street: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {[selection.city, selection.zip].filter(Boolean).join(' ') ||
                        'City unknown — will default to Downers Grove'}
                    </p>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {QUICK_STATUSES.map((qs) => (
                    <button
                      key={qs.status}
                      onClick={() => addDoor(qs.status)}
                      disabled={saving || selection.resolving}
                      className={`rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${qs.className}`}
                    >
                      {qs.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedLead ? (
              <div>
                <div className="flex items-center justify-between pr-6">
                  <p className="font-semibold text-slate-900">{selectedLead.street}</p>
                  <StatusBadge status={selectedLead.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {selectedLead.city}
                  {selectedLead.homeowner_name ? ` · ${selectedLead.homeowner_name}` : ''}
                </p>
                {selectedLead.notes && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{selectedLead.notes}</p>
                )}
                <Link
                  to={`/doors/${selectedLead.id}`}
                  className="mt-3 block rounded-xl bg-blue-700 py-3 text-center text-sm font-bold text-white"
                >
                  Open record
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
