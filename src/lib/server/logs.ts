import { db } from './auth';

const EVENTS = ['join', 'error', 'round'] as const;
type Event = (typeof EVENTS)[number];

/** One event from one browser, as the browser sent it. */
export type LogInput = {
  event: Event;
  deviceId: string;
  name: string | null;
  room: string | null;
  data: Record<string, unknown>;
};

/** Checks a log entry sent by a browser. Returns null if anything is off. */
export function parseLog(body: unknown): LogInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const event = EVENTS.find((e) => e === b.event);
  const deviceId = str(b.deviceId, 64);
  const data = b.data && typeof b.data === 'object' && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : {};
  if (!event || !deviceId || JSON.stringify(data).length > 4000) return null;
  return { event, deviceId, name: str(b.name, 20), room: str(b.room, 20), data };
}

/** Where the request came from: the client IP and Vercel's IP-based geolocation (absent locally). */
export function requestOrigin(h: Headers) {
  const get = (k: string) => {
    const v = h.get(k);
    return v ? decodeURIComponent(v) : null;
  };
  const num = (k: string) => {
    const v = Number(h.get(k));
    return h.get(k) && Number.isFinite(v) ? v : null;
  };
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip'),
    country: get('x-vercel-ip-country'),
    region: get('x-vercel-ip-country-region'),
    city: get('x-vercel-ip-city'),
    lat: num('x-vercel-ip-latitude'),
    lon: num('x-vercel-ip-longitude'),
    userAgent: h.get('user-agent')?.slice(0, 500) ?? null,
  };
}

export async function saveLog(l: LogInput, origin: ReturnType<typeof requestOrigin>, userId: string | null) {
  await db.query(
    `insert into event_log (event, device_id, user_id, name, room, ip, country, region, city, lat, lon, user_agent, data)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      l.event, l.deviceId, userId, l.name, l.room, origin.ip, origin.country, origin.region, origin.city,
      origin.lat, origin.lon, origin.userAgent, JSON.stringify(l.data),
    ],
  );
}
