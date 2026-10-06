import type { Difficulty, Role } from '@/lib/game/types';
import { db } from './auth';

/** One round from one player's point of view. */
export type GameRecord = {
  room: string;
  roundId: number;
  role: Role;
  difficulty: Difficulty;
  secret: string;
  won: boolean;
  guess: string | null;
  questions: number;
  team: { name: string; role: Role }[];
};

export type HistoryItem = GameRecord & { playedAt: string };

export type Stats = {
  played: number;
  won: number;
  byRole: Record<Role, { played: number; won: number }>;
  byDifficulty: Record<Difficulty, { played: number; won: number }>;
};

const ROLES: Role[] = ['mute', 'deaf', 'blind'];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Checks a record sent by a browser. Returns null if anything is off. */
export function parseRecord(body: unknown): GameRecord | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
  const role = ROLES.find((r) => r === b.role);
  const difficulty = DIFFICULTIES.find((d) => d === b.difficulty);
  const room = str(b.room, 20);
  const secret = str(b.secret, 200);
  const team = Array.isArray(b.team) && b.team.length === 3
    ? b.team.map((p) => ({ name: str(p?.name, 20), role: ROLES.find((r) => r === p?.role) }))
    : null;
  if (!role || !difficulty || !room || !secret || !team || team.some((p) => !p.name || !p.role)) return null;
  if (!Number.isSafeInteger(b.roundId) || typeof b.won !== 'boolean' || !Number.isInteger(b.questions)) return null;
  return {
    room, role, difficulty, secret,
    roundId: b.roundId as number,
    won: b.won,
    guess: b.guess == null ? null : str(b.guess, 100),
    questions: Math.max(0, Math.min(b.questions as number, 999)),
    team: team as GameRecord['team'],
  };
}

/** Saves a round once; the same round sent again is ignored. */
export async function saveGame(userId: string, g: GameRecord) {
  await db.query(
    `insert into game (user_id, room, round_id, role, difficulty, secret, won, guess, questions, team)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (user_id, room, round_id) do nothing`,
    [userId, g.room, g.roundId, g.role, g.difficulty, g.secret, g.won, g.guess, g.questions, JSON.stringify(g.team)],
  );
}

export async function getHistory(userId: string, limit = 50): Promise<HistoryItem[]> {
  const { rows } = await db.query(
    `select room, round_id, role, difficulty, secret, won, guess, questions, team, played_at
     from game where user_id = $1 order by played_at desc limit $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    room: r.room, roundId: Number(r.round_id), role: r.role, difficulty: r.difficulty, secret: r.secret,
    won: r.won, guess: r.guess, questions: r.questions, team: r.team, playedAt: r.played_at.toISOString(),
  }));
}

export async function getStats(userId: string): Promise<Stats> {
  const { rows } = await db.query(
    `select role, difficulty, count(*)::int as played, count(*) filter (where won)::int as won
     from game where user_id = $1 group by role, difficulty`,
    [userId],
  );
  const zero = () => ({ played: 0, won: 0 });
  const stats: Stats = {
    played: 0, won: 0,
    byRole: { mute: zero(), deaf: zero(), blind: zero() },
    byDifficulty: { easy: zero(), medium: zero(), hard: zero() },
  };
  for (const r of rows) {
    for (const bucket of [stats, stats.byRole[r.role as Role], stats.byDifficulty[r.difficulty as Difficulty]]) {
      if (!bucket) continue;
      bucket.played += r.played;
      bucket.won += r.won;
    }
  }
  return stats;
}
