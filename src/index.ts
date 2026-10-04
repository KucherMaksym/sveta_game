import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { WORDS, Difficulty } from './words';

type Role = 'mute' | 'deaf' | 'blind';
type Phase = 'lobby' | 'mime' | 'draw' | 'guess' | 'result';

interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  role: Role | null;
}

interface Room {
  id: string;
  hostId: string;
  players: Player[];
  difficulty: Difficulty;
  phase: Phase;
  secret: string;
  strokes: number[][];
  guesses: string[];
  won: boolean;
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const rooms = new Map<string, Room>();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const file = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function broadcastState(room: Room) {
  for (const p of room.players) {
    const canSeeSecret = room.phase === 'result' || p.role === 'mute';
    send(p.ws, {
      type: 'state',
      you: p.id,
      room: {
        id: room.id,
        hostId: room.hostId,
        difficulty: room.difficulty,
        phase: room.phase,
        players: room.players.map((x) => ({ id: x.id, name: x.name, role: x.role })),
        secret: canSeeSecret ? room.secret : null,
        guesses: room.guesses,
        won: room.won,
      },
    });
  }
}

function startRound(room: Room) {
  const roles: Role[] = ['mute', 'deaf', 'blind'].sort(() => Math.random() - 0.5) as Role[];
  room.players.forEach((p, i) => (p.role = roles[i]));
  const list = WORDS[room.difficulty];
  room.secret = list[Math.floor(Math.random() * list.length)];
  room.strokes = [];
  room.guesses = [];
  room.won = false;
  room.phase = 'mime';
  broadcastState(room);
  for (const p of room.players) send(p.ws, { type: 'strokes', strokes: [] });
}

const NEXT: Partial<Record<Phase, Phase>> = { mime: 'draw', draw: 'guess' };

wss.on('connection', (ws) => {
  let room: Room | null = null;
  let me: Player | null = null;

  ws.on('message', (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const roomId = String(msg.room || crypto.randomBytes(3).toString('hex'));
      room = rooms.get(roomId) || null;
      if (!room) {
        room = { id: roomId, hostId: '', players: [], difficulty: 'easy', phase: 'lobby', secret: '', strokes: [], guesses: [], won: false };
        rooms.set(roomId, room);
      }
      if (room.players.length >= 3) {
        send(ws, { type: 'error', message: 'Комната заполнена (максимум 3 игрока)' });
        room = null;
        return;
      }
      if (room.phase !== 'lobby') {
        send(ws, { type: 'error', message: 'Игра в этой комнате уже идёт' });
        room = null;
        return;
      }
      me = { id: crypto.randomUUID(), name: String(msg.name || 'Игрок').slice(0, 20), ws, role: null };
      // Newcomer initiates WebRTC connections to everyone already in the room.
      send(ws, { type: 'peers', ids: room.players.map((p) => p.id) });
      room.players.push(me);
      if (!room.hostId) room.hostId = me.id;
      broadcastState(room);
      return;
    }

    if (!room || !me) return;

    switch (msg.type) {
      case 'signal': {
        const target = room.players.find((p) => p.id === msg.to);
        if (target) send(target.ws, { type: 'signal', from: me.id, data: msg.data });
        break;
      }
      case 'difficulty':
        if (me.id === room.hostId && room.phase === 'lobby' && msg.value in WORDS) {
          room.difficulty = msg.value;
          broadcastState(room);
        }
        break;
      case 'start':
        if (me.id === room.hostId && room.players.length === 3 && (room.phase === 'lobby' || room.phase === 'result')) {
          startRound(room);
        }
        break;
      case 'next': {
        const next = NEXT[room.phase];
        if (next) {
          room.phase = next;
          broadcastState(room);
        }
        break;
      }
      case 'draw':
        if (room.phase === 'draw' && me.role === 'blind' && Array.isArray(msg.seg) && msg.seg.length === 4) {
          const seg = msg.seg.map(Number);
          room.strokes.push(seg);
          for (const p of room.players) if (p !== me) send(p.ws, { type: 'seg', seg });
        }
        break;
      case 'guess':
        if (room.phase === 'guess' && me.role === 'blind') {
          const g = String(msg.text || '').slice(0, 100).trim();
          if (!g) break;
          room.guesses.push(g);
          if (normalize(g) === normalize(room.secret)) {
            room.won = true;
            room.phase = 'result';
          }
          broadcastState(room);
          if (room.phase === 'result') for (const p of room.players) send(p.ws, { type: 'strokes', strokes: room.strokes });
        }
        break;
      case 'accept': // the mute knows the answer and can accept a close-enough guess
      case 'giveup':
        if (room.phase === 'guess' && (msg.type === 'giveup' || me.role === 'mute')) {
          room.won = msg.type === 'accept';
          room.phase = 'result';
          broadcastState(room);
          for (const p of room.players) send(p.ws, { type: 'strokes', strokes: room.strokes });
        }
        break;
    }

    // Blind sees their own board only from the guess phase on.
    if (msg.type === 'next' && room.phase === 'guess') {
      for (const p of room.players) send(p.ws, { type: 'strokes', strokes: room.strokes });
    }
  });

  ws.on('close', () => {
    if (!room || !me) return;
    room.players = room.players.filter((p) => p !== me);
    for (const p of room.players) send(p.ws, { type: 'peer-left', id: me.id });
    if (room.players.length === 0) {
      rooms.delete(room.id);
      return;
    }
    if (room.hostId === me.id) room.hostId = room.players[0].id;
    if (room.phase !== 'lobby') {
      room.phase = 'lobby';
      room.players.forEach((p) => (p.role = null));
    }
    broadcastState(room);
  });
});

server.listen(PORT, () => console.log(`Слепой, Глухой, Немой → http://localhost:${PORT}`));
