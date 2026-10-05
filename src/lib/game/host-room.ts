import { BRUSHES, PALETTE, PHASE_SECONDS, REVEAL_SECONDS, normalize } from './rules';
import type { ClientMessage, Difficulty, Phase, Role, RoomState, Segment, ServerMessage } from './types';
import { WORDS } from './words';

type Player = { id: string; name: string; role: Role | null; score: number; send: (msg: ServerMessage) => void };

const NEXT: Partial<Record<Phase, Phase>> = { mime: 'draw', draw: 'guess' };

/**
 * The authoritative room. Runs only in the host's browser; every player (the host included)
 * talks to it through `handle`, and it answers through each player's `send`.
 */
export function createHostRoom(id: string) {
  let players: Player[] = [];
  let hostId = '';
  let difficulty: Difficulty = 'easy';
  let phase: Phase = 'lobby';
  let round = 0;
  let secret = '';
  let strokes: Segment[] = [];
  let answers: RoomState['answers'] = [];
  let guesses: string[] = [];
  let won = false;
  let revealEndsAt: number | null = null;
  let phaseEndsAt: number | null = null;

  /** Moves to a phase and starts its countdown, `delay` ms from now. */
  function setPhase(next: Phase, delay = 0) {
    phase = next;
    const seconds = PHASE_SECONDS[next];
    phaseEndsAt = seconds ? Date.now() + delay + seconds * 1000 : null;
  }

  function broadcastState() {
    const now = Date.now();
    for (const p of players) {
      const canSeeSecret = phase === 'result' || p.role === 'mute';
      p.send({
        type: 'state',
        you: p.id,
        room: {
          id,
          hostId,
          difficulty,
          phase,
          round,
          players: players.map(({ id, name, role, score }) => ({ id, name, role, score })),
          secret: canSeeSecret ? secret : null,
          answers,
          guesses,
          won,
          revealEndsAt,
          phaseEndsAt,
        },
        now,
      });
    }
  }

  function sendStrokes() {
    for (const p of players) p.send({ type: 'strokes', strokes });
  }

  function startRound() {
    const roles: Role[] = ['mute', 'deaf', 'blind'].sort(() => Math.random() - 0.5) as Role[];
    players.forEach((p, i) => (p.role = roles[i]));
    const list = WORDS[difficulty];
    secret = list[Math.floor(Math.random() * list.length)];
    strokes = [];
    answers = [];
    guesses = [];
    won = false;
    round++;
    // Everyone gets the same few seconds with their role card, then turn 1 starts for all at once.
    revealEndsAt = Date.now() + REVEAL_SECONDS * 1000;
    setPhase('mime', REVEAL_SECONDS * 1000);
    broadcastState();
    sendStrokes();
  }

  function finish(win: boolean) {
    won = win;
    if (win) for (const p of players) p.score++;
    setPhase('result');
    broadcastState();
    sendStrokes();
  }

  function toLobby() {
    setPhase('lobby');
    revealEndsAt = null;
    for (const p of players) p.role = null;
    broadcastState();
  }

  function validSegment(seg: unknown): seg is Segment {
    if (!seg || typeof seg !== 'object') return false;
    const s = seg as Record<string, unknown>;
    const inBoard = ['x0', 'y0', 'x1', 'y1'].every((k) => typeof s[k] === 'number' && s[k] >= -0.1 && s[k] <= 1.1);
    return inBoard && Number.isInteger(s.c) && PALETTE[s.c as number] !== undefined && BRUSHES.includes(s.w as number);
  }

  return {
    addPlayer(name: string, send: Player['send']): Player | null {
      if (players.length >= 3) {
        send({ type: 'error', message: 'Комната заполнена: играют ровно трое' });
        return null;
      }
      if (phase !== 'lobby') {
        send({ type: 'error', message: 'В этой комнате уже идёт игра' });
        return null;
      }
      const player: Player = { id: crypto.randomUUID(), name: name.trim().slice(0, 20) || 'Игрок', role: null, score: 0, send };
      // The newcomer initiates WebRTC connections to everyone already in the room.
      send({ type: 'peers', ids: players.map((p) => p.id) });
      players.push(player);
      if (!hostId) hostId = player.id;
      broadcastState();
      return player;
    },

    removePlayer(player: Player) {
      if (!players.includes(player)) return;
      players = players.filter((p) => p !== player);
      for (const p of players) p.send({ type: 'peer-left', id: player.id });
      if (phase !== 'lobby') toLobby();
      else broadcastState();
    },

    handle(me: Player, msg: ClientMessage) {
      const isHost = me.id === hostId;
      switch (msg.type) {
        case 'signal':
          players.find((p) => p.id === msg.to)?.send({ type: 'signal', from: me.id, data: msg.data });
          break;
        case 'difficulty':
          if (isHost && phase === 'lobby' && msg.value in WORDS) {
            difficulty = msg.value;
            broadcastState();
          }
          break;
        case 'start':
          if (isHost && players.length === 3 && (phase === 'lobby' || phase === 'result')) startRound();
          break;
        case 'lobby':
          if (isHost && phase === 'result') toLobby();
          break;
        case 'next': {
          const next = NEXT[phase];
          if (!next || (revealEndsAt && Date.now() < revealEndsAt)) break;
          setPhase(next);
          broadcastState();
          // The blind sees their own board only from the guess phase on.
          if (next === 'guess') sendStrokes();
          break;
        }
        case 'draw':
          if (phase === 'draw' && me.role === 'blind' && validSegment(msg.seg)) {
            const { x0, y0, x1, y1, c, w } = msg.seg;
            const seg = { x0, y0, x1, y1, c, w };
            strokes.push(seg);
            for (const p of players) if (p !== me) p.send({ type: 'seg', seg });
          }
          break;
        case 'clear':
          if (phase === 'draw' && me.role === 'blind') {
            strokes = [];
            sendStrokes();
          }
          break;
        case 'answer':
          // The deaf relays the mute's nod and logs it for everyone.
          if (phase === 'guess' && me.role === 'deaf' && (msg.value === 'yes' || msg.value === 'no')) {
            answers = [...answers, msg.value];
            broadcastState();
          }
          break;
        case 'guess': {
          if (phase !== 'guess' || me.role !== 'blind') break;
          const g = String(msg.text || '').slice(0, 100).trim();
          if (!g) break;
          guesses = [...guesses, g];
          if (normalize(g) === normalize(secret)) finish(true);
          else broadcastState();
          break;
        }
        case 'accept': // the mute knows the answer and can accept a close-enough guess
          if (phase === 'guess' && me.role === 'mute' && guesses.length) finish(true);
          break;
        case 'giveup':
          if (phase === 'guess') finish(false);
          break;
      }
    },
  };
}

export type HostRoom = ReturnType<typeof createHostRoom>;
export type HostPlayer = Player;
