'use client';

import { canReceive } from '@/lib/game/rules';
import type { PublicPlayer, Role } from '@/lib/game/types';
import { useGame } from '../game-context';
import { PlayerTag } from './role';

/** Callback ref that (re)attaches a stream whenever the element mounts or the stream changes. */
function srcObject(stream: MediaStream | null | undefined) {
  return (el: HTMLMediaElement | null) => {
    if (!el || el.srcObject === (stream ?? null)) return;
    el.srcObject = stream ?? null;
    if (stream) el.play().catch(() => {});
  };
}

export function Wave() {
  return <div className="wave" aria-hidden><span /><span /><span /><span /><span /></div>;
}

type TileProps = {
  player?: PublicPlayer;
  /** The player's id, or 'self' for my own camera. */
  of: string;
  ring?: Role | null;
  className?: string;
  placeholder?: string;
  children?: React.ReactNode;
};

/**
 * A player's camera as I'm allowed to see it right now: video if the rules let me see them,
 * a dark "voice only" tile if I may only hear them, nothing otherwise.
 * Video is always muted here: sound goes through <AudioSink>.
 */
export function PlayerTile({ player, of, ring, className = '', placeholder = 'видео игрока', children }: TileProps) {
  const { snap, room, me } = useGame();
  const self = of === 'self';
  const id = self ? me.id : of;
  const stream = self ? snap.local : snap.remote[of];
  const canSee = self ? true : canReceive(room, id, me.id, 'video');
  const canHear = self ? false : canReceive(room, id, me.id, 'audio');
  const hasVideo = !!stream?.getVideoTracks().length;
  const ringClass = ring ? ` tile--ring-${ring}` : '';
  const label = <PlayerTag player={player} you={self} className="tile__label" />;

  if (!canSee && canHear) {
    return (
      <div className={`tile tile--voice${ringClass} ${className}`} style={{ color: ring ? `var(--${ring})` : undefined }}>
        <Wave />
        <div style={{ color: 'var(--paper)' }}>только голос</div>
        {label}
      </div>
    );
  }
  return (
    <div className={`tile${self ? ' tile--self' : ''}${ringClass} ${className}`}>
      {!(canSee && hasVideo) && <div className="tile__placeholder">{canSee ? placeholder : 'не видно'}</div>}
      {canSee && hasVideo && <video ref={srcObject(stream)} autoPlay playsInline muted />}
      {label}
      {children}
    </div>
  );
}

function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  return <audio ref={srcObject(stream)} autoPlay muted={muted} />;
}

/** Plays every remote voice, muted unless the rules let me hear that player in this phase. */
export function AudioSink() {
  const { snap, room, me } = useGame();
  return (
    <div hidden>
      {Object.entries(snap.remote).map(([id, stream]) => (
        <RemoteAudio key={id} stream={stream} muted={!canReceive(room, id, me.id, 'audio')} />
      ))}
    </div>
  );
}
