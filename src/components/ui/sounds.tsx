'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { inRound } from '@/lib/game/rules';
import { isMuted, playSound, setMuted, subscribeMuted, type Sound } from '@/lib/sound';
import { useGame } from '../game-context';
import { useCountdown } from './progress';

/**
 * Plays sound effects for game events by watching the room state. Renders nothing.
 * The deaf hears no effects during turns: their role takes sound away.
 */
export function GameSounds({ revealing }: { revealing: boolean }) {
  const { snap, room, me } = useGame();
  const silent = me.role === 'deaf' && inRound(room.phase) && !revealing;
  const play = (s: Sound) => {
    if (!silent) playSound(s);
  };

  const prev = useRef({ ...room, revealing });
  useEffect(() => {
    const was = prev.current;
    prev.current = { ...room, revealing };

    if (room.revealEndsAt && room.revealEndsAt !== was.revealEndsAt) return play('reveal');
    if (was.revealing && !revealing) return play('go');
    if (room.phase !== was.phase) {
      if (room.phase === 'draw' || room.phase === 'guess') play('phase');
      if (room.phase === 'result') play(room.won ? 'win' : 'lose');
      return;
    }
    if (room.phase === 'lobby' && room.players.length > was.players.length) return play('join');
    if (room.answers.length > was.answers.length) return play(room.answers.at(-1) === 'yes' ? 'yes' : 'no');
    if (room.guesses.length > was.guesses.length) play('guess');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, revealing]);

  // Ticks: the last 3 seconds before the round starts, and the last 10 seconds of each turn.
  const revealLeft = useCountdown(room.revealEndsAt, snap.clockOffset);
  const phaseLeft = useCountdown(room.phaseEndsAt, snap.clockOffset);
  const tickAt = revealing ? (revealLeft <= 3 ? revealLeft : 0) : inRound(room.phase) && phaseLeft <= 10 ? phaseLeft : 0;
  useEffect(() => {
    if (tickAt > 0) play('tick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickAt]);

  return null;
}

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  return (
    <button className="sound-toggle" onClick={() => setMuted(!muted)} aria-pressed={!muted}
      title={muted ? 'Включить звуки' : 'Выключить звуки'} aria-label={muted ? 'Включить звуки' : 'Выключить звуки'}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {muted
          ? <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
