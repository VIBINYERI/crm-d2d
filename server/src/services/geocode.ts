// Free geocoding via OpenStreetMap Nominatim. No API key needed, but be a
// polite citizen: identify the app and never hammer the endpoint. A failed
// or slow lookup just leaves lat/lng null — the lead still saves.
export async function geocode(
  street: string,
  city: string,
  zip?: string | null
): Promise<{ lat: number; lng: number } | null> {
  const q = [street, city, 'IL', zip].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'crm-d2d/1.0 (d2d sales crm)' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
