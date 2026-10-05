'use client';

import Link from 'next/link';
import { ROLES, myChannels } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { Steps, Timer } from '../ui/progress';
import { ChannelStatus, roleBg } from '../ui/role';

/** Logo, my role, my channels, round progress and the phase timer. */
export function TopBar() {
  const { snap, room, me } = useGame();
  return (
    <header className="topbar enter">
      <div className="topbar__left">
        <Link className="logo" href="/" title="Выйти на главную">С·Г·Н</Link>
        {me.role && <span className={`tag ${roleBg(me.role)}`}>ты · {ROLES[me.role].title}</span>}
        <ChannelStatus channels={myChannels(room, me.id)} />
      </div>
      <Steps phase={room.phase} />
      {room.phaseEndsAt && <Timer endsAt={room.phaseEndsAt} offset={snap.clockOffset} />}
    </header>
  );
}
