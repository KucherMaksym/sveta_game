import type { DataConnection, Peer as PeerJS, PeerError } from 'peerjs';
import { createHostRoom } from '@/lib/game/host-room';
import { inRound, roleOf } from '@/lib/game/rules';
import type { ClientMessage, RoomState, Segment, ServerMessage } from '@/lib/game/types';
import { logEvent } from '@/lib/log';
import { Mesh } from './mesh';
import { peerIdFor } from './room-code';

export type SessionStatus = 'connecting' | 'in-room' | 'failed' | 'disconnected';

export type SessionSnapshot = {
  code: string;
  isHost: boolean;
  status: SessionStatus;
  /** Why joining failed or the room was lost. */
  error: string | null;
  /** True when we could not get a camera or a microphone. */
  noMedia: boolean;
  myId: string | null;
  room: RoomState | null;
  local: MediaStream | null;
  remote: Record<string, MediaStream>;
  /** Host clock minus my clock, in ms: add it to Date.now() to get the host's time. */
  clockOffset: number;
};

type StrokeEvent = { kind: 'reset' } | { kind: 'seg'; seg: Segment };

const PEER_ERRORS: Record<string, string> = {
  'peer-unavailable': 'Комната не найдена: возможно, хост закрыл вкладку. Попроси новую ссылку.',
  'unavailable-id': 'Эта комната уже открыта в другой вкладке. Создай новую.',
  network: 'Нет связи с сервером соединений. Проверь интернет и обнови страницу.',
  'server-error': 'Сервер соединений недоступен. Попробуй ещё раз через минуту.',
  'browser-incompatible': 'Этот браузер не умеет видеозвонки. Открой игру в Chrome, Safari или Firefox.',
};

async function getMedia() {
  for (const c of [{ video: true, audio: true }, { audio: true }, { video: true }]) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch {}
  }
  return new MediaStream();
}

/**
 * One player's connection to one room. Framework-agnostic: React reads it through
 * `subscribe` / `getSnapshot`, the drawing board listens to `onStrokes`.
 *
 * The host's browser runs the room itself (see host-room.ts); guests reach it over a PeerJS
 * data channel. PeerJS is used only for that channel and for WebRTC signalling; audio and
 * video go peer-to-peer through `Mesh`.
 */
export class GameSession {
  strokes: Segment[] = [];

  private snapshot: SessionSnapshot;
  private listeners = new Set<() => void>();
  private strokeListeners = new Set<(e: StrokeEvent) => void>();
  private peer: PeerJS | null = null;
  private mesh: Mesh | null = null;
  private sendRaw: (msg: ClientMessage) => void = () => {};
  private destroyed = false;

  constructor(code: string, private name: string, isHost: boolean) {
    this.snapshot = {
      code, isHost, status: 'connecting', error: null, noMedia: false, myId: null, room: null, local: null, remote: {}, clockOffset: 0,
    };
  }

  // ---------- store API ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  onStrokes(fn: (e: StrokeEvent) => void) {
    this.strokeListeners.add(fn);
    return () => this.strokeListeners.delete(fn);
  }

  private set(patch: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  // ---------- lifecycle ----------

  async start() {
    const local = await getMedia();
    if (this.destroyed) return local.getTracks().forEach((t) => t.stop());
    this.mesh = new Mesh(
      local,
      (to, data) => this.send({ type: 'signal', to, data }),
      () => this.set({ remote: this.mesh!.streams() }),
    );
    this.set({ local, noMedia: local.getTracks().length === 0 });
    logEvent('join', this.name, this.snapshot.code, {
      host: this.snapshot.isHost,
      video: local.getVideoTracks().length > 0,
      audio: local.getAudioTracks().length > 0,
    });

    const { Peer } = await import('peerjs'); // browser-only library
    if (this.destroyed) return;
    if (this.snapshot.isHost) this.startAsHost(Peer);
    else this.startAsGuest(Peer);
  }

  destroy() {
    this.destroyed = true;
    this.peer?.destroy();
    this.mesh?.close();
    this.snapshot.local?.getTracks().forEach((t) => t.stop());
    this.listeners.clear();
    this.strokeListeners.clear();
  }

  private fail(err: PeerError<string> | { type: string }) {
    const error = PEER_ERRORS[err.type] ?? `Ошибка соединения: ${err.type}`;
    this.set({ status: this.snapshot.room ? 'disconnected' : 'failed', error });
    logEvent('error', this.name, this.snapshot.code, { type: err.type, inRoom: !!this.snapshot.room });
  }

  private startAsHost(Peer: typeof PeerJS) {
    const peer = (this.peer = new Peer(peerIdFor(this.snapshot.code)));
    peer.on('error', (err) => this.fail(err));
    peer.on('open', () => {
      const host = createHostRoom(this.snapshot.code);
      const me = host.addPlayer(this.name, (msg) => queueMicrotask(() => this.receive(msg)))!;
      this.sendRaw = (msg) => host.handle(me, msg);
      peer.on('connection', (conn: DataConnection) => {
        let player: ReturnType<typeof host.addPlayer> = null;
        conn.on('data', (data) => {
          const msg = data as ClientMessage;
          if (msg?.type === 'join' && !player) {
            player = host.addPlayer(String(msg.name), (m) => conn.open && conn.send(m));
            if (!player) setTimeout(() => conn.close(), 500);
          } else if (player) host.handle(player, msg);
        });
        conn.on('close', () => player && host.removePlayer(player));
      });
    });
  }

  private startAsGuest(Peer: typeof PeerJS) {
    const peer = (this.peer = new Peer());
    peer.on('error', (err) => this.fail(err));
    peer.on('open', () => {
      const conn = peer.connect(peerIdFor(this.snapshot.code), { serialization: 'json', reliable: true });
      conn.on('open', () => {
        this.sendRaw = (msg) => conn.send(msg);
        this.send({ type: 'join', name: this.name });
      });
      conn.on('data', (data) => this.receive(data as ServerMessage));
      conn.on('close', () => {
        if (!this.destroyed && this.snapshot.room) {
          this.set({ status: 'disconnected', error: 'Хост вышел из игры. Чтобы сыграть снова, нужна новая ссылка.' });
        }
      });
    });
  }

  private receive(msg: ServerMessage) {
    if (this.destroyed) return;
    switch (msg.type) {
      case 'error':
        this.set({ status: 'failed', error: msg.message });
        break;
      case 'peers':
        for (const id of msg.ids) this.mesh?.connect(id);
        break;
      case 'signal':
        this.mesh?.signal(msg.from, msg.data);
        break;
      case 'peer-left':
        this.mesh?.remove(msg.id);
        break;
      case 'state': {
        // `now` left the host a moment ago, so each sample underestimates the offset by the
        // message's travel time. The largest sample is the one that travelled the fastest.
        const sample = msg.now - Date.now();
        const clockOffset = this.snapshot.room ? Math.max(this.snapshot.clockOffset, sample) : sample;
        this.set({ status: 'in-room', myId: msg.you, room: msg.room, clockOffset });
        this.applyLocalRules(msg.you, msg.room);
        break;
      }
      case 'strokes':
        this.strokes = msg.strokes;
        this.emitStrokes({ kind: 'reset' });
        break;
      case 'seg':
        this.strokes.push(msg.seg);
        this.emitStrokes({ kind: 'seg', seg: msg.seg });
        break;
    }
  }

  private emitStrokes(e: StrokeEvent) {
    for (const fn of this.strokeListeners) fn(e);
  }

  /** The mute's microphone is physically off for the whole round. */
  private applyLocalRules(myId: string, room: RoomState) {
    const muted = inRound(room.phase) && roleOf(room, myId) === 'mute';
    for (const t of this.snapshot.local?.getAudioTracks() ?? []) t.enabled = !muted;
  }

  // ---------- actions ----------

  send(msg: ClientMessage) {
    if (!this.destroyed) this.sendRaw(msg);
  }

  /** Draws locally right away, then tells the room. */
  draw(seg: Segment) {
    this.strokes.push(seg);
    this.send({ type: 'draw', seg });
  }
}

// ---------- the one active session ----------
// Lives outside React so StrictMode remounts and route changes don't tear the call down.

let current: GameSession | null = null;

export function openSession(code: string, name: string, isHost: boolean) {
  current?.destroy();
  current = new GameSession(code, name, isHost);
  void current.start();
  return current;
}

export function getSession(code: string) {
  return current && current.getSnapshot().code === code ? current : null;
}

export function closeSession() {
  current?.destroy();
  current = null;
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', closeSession);
