import type { Difficulty, Level, Phase, Role, RoomState } from './types';

export const ROLES: Record<Role, { title: string; letter: string; about: string; reveal: string; off: Channel }> = {
  mute: {
    title: 'Немой',
    letter: 'Н',
    about: 'Знает загадку. Показывает её руками и лицом.',
    reveal: 'Микрофон выключен. Показывай загадку только руками и лицом.',
    off: 'mic',
  },
  deaf: {
    title: 'Глухой',
    letter: 'Г',
    about: 'Расшифровывает пантомиму и объясняет Слепому словами.',
    reveal: 'Звук выключен. Читай пантомиму Немого, потом объясняй Слепому словами.',
    off: 'sound',
  },
  blind: {
    title: 'Слепой',
    letter: 'С',
    about: 'Рисует наугад, задаёт вопросы да/нет и угадывает.',
    reveal: 'Камера выключена. Рисуй наугад по подсказкам Глухого, потом угадывай.',
    off: 'camera',
  },
};

export type Channel = 'camera' | 'mic' | 'sound';
export const CHANNEL_LABEL: Record<Channel, string> = { camera: 'камера', mic: 'микро', sound: 'звук' };

export const DIFFICULTY: Record<Difficulty, { label: string; short: string }> = {
  easy: { label: 'Слово', short: 'Слово' },
  medium: { label: 'Словосочетание', short: 'Фраза' },
  hard: { label: 'Предложение', short: 'Предлож.' },
};

export const LEVEL: Record<Level, { label: string; about: string }> = {
  normal: { label: 'Лёгкая', about: 'обычные вещи' },
  weird: { label: 'Средняя', about: 'слегка дичь' },
  insane: { label: 'Сложная', about: 'лютая дичь' },
};

export const STEPS = [
  { phase: 'mime', label: '1 Пантомима' },
  { phase: 'draw', label: '2 Рисунок' },
  { phase: 'guess', label: '3 Да/нет' },
] as const;

/** Soft per-phase countdown, in seconds. Purely visual: players advance the game themselves. */
export const PHASE_SECONDS: Partial<Record<Phase, number>> = { mime: 120, draw: 90, guess: 180 };

/** How long everyone looks at their role card before the round starts for all at once. */
export const REVEAL_SECONDS = 8;

/** Every board is this shape on every screen, so a line lands in the same place for everyone. */
export const BOARD_RATIO = 4 / 3;

/** Drawing palette, shared by the toolbar and the canvas. Index 0 is ink; the last one is the eraser. */
export const PALETTE = ['#1f1a2e', 'oklch(0.7 0.17 28)', 'oklch(0.7 0.13 195)', 'oklch(0.82 0.16 95)', 'oklch(0.6 0.17 150)', '#ffffff'];
export const ERASER = PALETTE.length - 1;
export const BRUSHES = [4, 9, 16, 32];

type Kind = 'video' | 'audio';

// Who can see / hear whom in each phase: [fromRole, toRole, kind]. '*' means everyone, everything.
const LINKS: Record<Phase, '*' | [Role, Role, Kind][]> = {
  lobby: '*',
  result: '*',
  mime: [['mute', 'deaf', 'video'], ['deaf', 'mute', 'video'], ['deaf', 'mute', 'audio']],
  // The mute only watches the blind draw: no sound either way.
  draw: [['deaf', 'blind', 'audio'], ['blind', 'mute', 'video']],
  guess: [
    ['blind', 'mute', 'audio'], ['mute', 'deaf', 'video'], ['deaf', 'blind', 'audio'],
    ['deaf', 'mute', 'audio'], ['deaf', 'mute', 'video'],
  ],
};

export function inRound(phase: Phase) {
  return phase === 'mime' || phase === 'draw' || phase === 'guess';
}

export function roleOf(room: RoomState, id: string) {
  return room.players.find((p) => p.id === id)?.role ?? null;
}

export function playerByRole(room: RoomState, role: Role) {
  return room.players.find((p) => p.role === role);
}

export function canReceive(room: RoomState, fromId: string, toId: string, kind: Kind) {
  const links = LINKS[room.phase];
  if (links === '*') return true;
  const from = roleOf(room, fromId);
  const to = roleOf(room, toId);
  return links.some(([f, t, k]) => f === from && t === to && k === kind);
}

/** Which of my own channels work right now (the role switches one off for the whole round). */
export function myChannels(room: RoomState, myId: string): Record<Channel, boolean> {
  const role = roleOf(room, myId);
  const off = inRound(room.phase) && role ? ROLES[role].off : null;
  return { camera: off !== 'camera', mic: off !== 'mic', sound: off !== 'sound' };
}

export function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
