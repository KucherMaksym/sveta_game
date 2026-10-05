// Room codes look like "KOTE-42": easy to read aloud and to type on a phone.
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'; // no I, O, Q: too easy to confuse with 1 and 0

export function newRoomCode() {
  const pick = () => LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const digits = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `${pick()}${pick()}${pick()}${pick()}-${digits}`;
}

/** Turns whatever the user typed or pasted (a code or a whole invite link) into "ABCD-12", or null. */
export function parseRoomCode(input: string) {
  const raw = input.trim().split('/').pop() ?? '';
  const clean = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{4})(\d{2})$/.exec(clean);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function peerIdFor(code: string) {
  return `sgn-game-${code.replace('-', '').toLowerCase()}`;
}
