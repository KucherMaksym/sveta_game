export type Role = 'mute' | 'deaf' | 'blind';
export type Phase = 'lobby' | 'mime' | 'draw' | 'guess' | 'result';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Answer = 'yes' | 'no';

export type PublicPlayer = { id: string; name: string; role: Role | null; score: number };

/** What every player sees. `secret` is null for players who must not know it yet. */
export type RoomState = {
  id: string;
  hostId: string;
  difficulty: Difficulty;
  phase: Phase;
  round: number;
  players: PublicPlayer[];
  secret: string | null;
  answers: Answer[];
  guesses: string[];
  won: boolean;
  /** Host-clock ms. While it's in the future, everyone is looking at their role card. */
  revealEndsAt: number | null;
  /** Host-clock ms when the current phase's countdown hits zero. */
  phaseEndsAt: number | null;
};

/** A line segment in board coordinates (0..1), with a palette color index and a brush size. */
export type Segment = { x0: number; y0: number; x1: number; y1: number; c: number; w: number };

/** Guest/host player → room. */
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'signal'; to: string; data: SignalData }
  | { type: 'difficulty'; value: Difficulty }
  | { type: 'start' }
  | { type: 'lobby' }
  | { type: 'next' }
  | { type: 'draw'; seg: Segment }
  | { type: 'clear' }
  | { type: 'answer'; value: Answer }
  | { type: 'guess'; text: string }
  | { type: 'accept' }
  | { type: 'giveup' };

/** Room → player. */
export type ServerMessage =
  | { type: 'error'; message: string }
  | { type: 'peers'; ids: string[] }
  | { type: 'peer-left'; id: string }
  | { type: 'signal'; from: string; data: SignalData }
  /** `now` is the host's clock when it sent this, so players can sync their timers to it. */
  | { type: 'state'; you: string; room: RoomState; now: number }
  | { type: 'strokes'; strokes: Segment[] }
  | { type: 'seg'; seg: Segment };

export type SignalData = { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
