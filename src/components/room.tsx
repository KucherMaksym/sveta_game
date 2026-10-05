'use client';

import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { closeSession, getSession, openSession, type GameSession } from '@/lib/net/session';
import { unlockSounds } from '@/lib/sound';
import { GameProvider } from './game-context';
import { DrawScreen } from './screens/draw';
import { GuessScreen } from './screens/guess';
import { JoinScreen } from './screens/join';
import { Lobby } from './screens/lobby';
import { MimeScreen } from './screens/mime';
import { ResultScreen } from './screens/result';
import { RoleReveal } from './screens/reveal';
import { Connecting, Problem } from './screens/status';
import { GameSounds } from './ui/sounds';

const noop = () => () => {};
const none = () => null;

export function Room({ code }: { code: string }) {
  // Set when we arrive from the start page; empty when someone opens an invite link.
  const [session, setSession] = useState<GameSession | null>(() => getSession(code));
  const snap = useSyncExternalStore(session?.subscribe ?? noop, session?.getSnapshot ?? none, none);
  const revealEndsAt = snap?.room?.revealEndsAt ?? null;
  const offset = snap?.clockOffset ?? 0;
  const revealLeft = revealEndsAt ? revealEndsAt - Date.now() - offset : 0;

  // Re-render exactly when the shared role-card countdown runs out, so the round starts for everyone at once.
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (revealLeft <= 0) return;
    const t = setTimeout(rerender, revealLeft);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealEndsAt, offset]);

  if (!session || !snap) {
    return <JoinScreen invite={code} onJoin={(name) => {
      unlockSounds();
      setSession(openSession(code, name, false));
    }} />;
  }

  if (snap.status === 'failed' || snap.status === 'disconnected') {
    const retry = snap.isHost ? undefined : () => {
      closeSession();
      setSession(null);
    };
    return <Problem title={snap.status === 'failed' ? 'Не получилось войти' : 'Соединение потеряно'} text={snap.error ?? ''} onRetry={retry} />;
  }

  const room = snap.room;
  const me = room?.players.find((p) => p.id === snap.myId);
  if (!room || !me) return <Connecting />;

  const game = { session, snap, room, me, isHost: me.id === room.hostId };
  const revealing = room.phase === 'mime' && me.role && revealLeft > 0;

  return (
    <GameProvider value={game}>
      <GameSounds revealing={!!revealing} />
      {revealing ? <RoleReveal />
        : room.phase === 'lobby' ? <Lobby />
        : room.phase === 'mime' ? <MimeScreen />
        : room.phase === 'draw' ? <DrawScreen />
        : room.phase === 'guess' ? <GuessScreen />
        : <ResultScreen />}
      {snap.noMedia && (
        <div className="chip bg-mute" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 4, fontSize: 13, padding: '7px 12px' }}>
          нет доступа к камере и микрофону
        </div>
      )}
    </GameProvider>
  );
}
