'use client';

import { createContext, useContext } from 'react';
import type { PublicPlayer, RoomState } from '@/lib/game/types';
import type { GameSession, SessionSnapshot } from '@/lib/net/session';

export type Game = {
  session: GameSession;
  snap: SessionSnapshot;
  room: RoomState;
  me: PublicPlayer;
  isHost: boolean;
};

const GameContext = createContext<Game | null>(null);
export const GameProvider = GameContext.Provider;

/** Everything a screen needs; only rendered once we are in the room. */
export function useGame() {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame() outside of a room');
  return game;
}
