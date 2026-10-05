'use client';

import { ROLES } from '@/lib/game/rules';
import type { Role } from '@/lib/game/types';
import { useGame } from '../game-context';
import { TopBar } from './shell';
import styles from './rounds.module.css';

/** For the player who sits this turn out: they neither see nor hear the other two. */
export function Waiting({ pair, text }: { pair: [Role, Role]; text: string }) {
  const { room } = useGame();
  const names = pair.map((r) => room.players.find((p) => p.role === r)?.name ?? ROLES[r].title);
  return (
    <main className="page page--dark page--fit">
      <TopBar />
      <div className={styles.wait}>
        <div className={`${styles.waitPair} pop`}>
          {pair.map((r) => <div key={r} className={`role-badge role-badge--lg bg-${r}`}>{ROLES[r].letter}</div>)}
        </div>
        <h1 className={`${styles.waitTitle} enter enter-1`}>{names[0]} и {names[1]} в своей комнате</h1>
        <p className="t-lead enter enter-2" style={{ color: 'var(--paper)', maxWidth: 560 }}>{text}</p>
        <p className={`t-mono enter enter-3 ${styles.dots}`} style={{ fontSize: 14 }}>ждём</p>
      </div>
    </main>
  );
}
