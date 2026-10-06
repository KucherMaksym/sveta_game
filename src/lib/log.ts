type Event = 'join' | 'error' | 'round';

const DEVICE_KEY = 'sgn-device';

/** A random id kept in this browser, so visits from one device can be told apart. */
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) localStorage.setItem(DEVICE_KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    return 'no-storage';
  }
}

/** Sends one event to `/api/log`. Fire-and-forget: logging never gets in the way of the game. */
export function logEvent(event: Event, name: string | null, room: string | null, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    event, name, room, deviceId: deviceId(),
    data: {
      ...data,
      lang: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
      platform: navigator.platform,
      referrer: document.referrer || null,
    },
  });
  fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
}
