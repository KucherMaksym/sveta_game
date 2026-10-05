'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { newRoomCode } from '@/lib/net/room-code';
import { closeSession, openSession } from '@/lib/net/session';
import { JoinScreen } from './screens/join';

export function Home() {
  const router = useRouter();
  // Coming back to the start page means leaving the room.
  useEffect(() => closeSession(), []);

  return (
    <JoinScreen
      onCreate={(name) => {
        const code = newRoomCode();
        openSession(code, name, true);
        router.push(`/room/${code}`);
      }}
      onJoin={(name, code) => {
        openSession(code, name, false);
        router.push(`/room/${code}`);
      }}
    />
  );
}
