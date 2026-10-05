'use client';

import { useState } from 'react';
import { REVEAL_SECONDS, ROLES } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { useCountdown } from '../ui/progress';
import { RoleBadge, RoleChips, roleBg } from '../ui/role';
import styles from './reveal.module.css';

/**
 * "Тебе выпало…": deals the three role cards, mine flips face up in the middle.
 * No button: a shared countdown starts turn 1 for all three players at the same moment.
 */
export function RoleReveal() {
  const { snap, room, me } = useGame();
  const left = useCountdown(room.revealEndsAt, snap.clockOffset);
  // Start the progress bar part-way through if this screen appeared late, so all bars drain in step.
  const [elapsed] = useState(() => REVEAL_SECONDS * 1000 - ((room.revealEndsAt ?? 0) - Date.now() - snap.clockOffset));
  const role = me.role!;
  const others = room.players.filter((p) => p.id !== me.id);

  return (
    <main className={`page page--dark page--center ${styles.page}`}>
      <h1 className={`t-h2 ${styles.title}`}>Тебе выпало…</h1>
      <div className={styles.deck}>
        <div className={`${styles.ghost} ${styles.left} ${roleBg(others[0]?.role ?? null)}`}>{others[0]?.name}</div>
        <div className={styles.flip}>
          <div className={`role-card ${roleBg(role)} ${styles.card}`}>
            <RoleBadge role={role} large />
            <div className="role-card__name">{ROLES[role].title}</div>
            <div className="role-card__text">{ROLES[role].reveal}</div>
            <RoleChips role={role} />
          </div>
          <div className={styles.back} aria-hidden>?</div>
        </div>
        <div className={`${styles.ghost} ${styles.right} ${roleBg(others[1]?.role ?? null)}`}>{others[1]?.name}</div>
      </div>
      <div className={styles.reveal}>
        {room.secret && (
          <div className={styles.secret}>
            <span className="t-mono">загадка · только для тебя</span>
            <b>{room.secret}</b>
          </div>
        )}
        <div className={styles.countdown} role="timer" aria-label={`Старт через ${left}`}>
          <span className="t-mono">старт через</span>
          <b key={left} className={left <= 3 ? styles.hot : ''}>{left}</b>
          <div className={styles.bar}>
            <div style={{ animationDuration: `${REVEAL_SECONDS}s`, animationDelay: `${-Math.max(0, elapsed)}ms` }} />
          </div>
        </div>
      </div>
    </main>
  );
}
