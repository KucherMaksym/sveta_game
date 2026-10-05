'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DIFFICULTY } from '@/lib/game/rules';
import type { Difficulty } from '@/lib/game/types';
import { useGame } from '../game-context';
import { PlayerTile } from '../ui/media';
import { SoundToggle } from '../ui/sounds';
import styles from './lobby.module.css';

export function Lobby() {
  const { session, room, me, isHost } = useGame();
  const [copied, setCopied] = useState(false);
  const full = room.players.length === 3;
  const others = room.players.filter((p) => p.id !== me.id);

  async function invite() {
    const url = `${location.origin}/room/${room.id}`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: 'Слепой, Глухой, Немой', text: 'Залетай играть!', url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className={`page ${styles.page}`}>
      <div className="topbar enter">
        <Link className="logo" href="/">С·Г·Н</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {room.round > 0 && <span className="t-small">Сыграно раундов: {room.round}</span>}
          <SoundToggle />
        </div>
      </div>

      <div className={`${styles.invite} enter enter-1`}>
        <h1 className="t-h1">Зови друзей</h1>
        <div className="room-code">{room.id}</div>
        <button className={`btn btn--yellow btn--sm ${copied ? 'pop' : ''}`} onClick={invite}>
          {copied ? 'Ссылка скопирована!' : 'Скопировать ссылку'}
        </button>
      </div>

      <div className={styles.players}>
        {[me, ...others].map((p, i) => (
          <div key={p.id} className={`${styles.player} pop`} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
            <PlayerTile of={p.id === me.id ? 'self' : p.id}>
              {p.id === room.hostId && <span className="tag tag--dark tile__corner tile__corner--left">хост</span>}
            </PlayerTile>
            <div className={styles.row}>
              {p.name}{p.id === me.id && ' (ты)'}
              {p.score > 0 && <span className="chip">★ {p.score}</span>}
            </div>
          </div>
        ))}
        {Array.from({ length: 3 - room.players.length }, (_, i) => (
          <div key={i} className={`${styles.player} ${styles.empty} enter enter-2`}>
            <div className="tile tile--empty"><div className="q">?</div><div>Ждём {room.players.length + i === 1 ? 'второго' : 'третьего'}…</div></div>
            <div className={styles.row}>Свободное место</div>
          </div>
        ))}
      </div>

      <div className={`${styles.bottom} enter enter-3`}>
        <div>
          <div className="field"><label>Сложность загадки</label></div>
          <div className="segmented">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
              <button key={d} aria-pressed={room.difficulty === d} disabled={!isHost}
                onClick={() => session.send({ type: 'difficulty', value: d })}>
                <span className={styles.long}>{DIFFICULTY[d].label}</span>
                <span className={styles.short}>{DIFFICULTY[d].short}</span>
              </button>
            ))}
          </div>
          <div className="t-small">например: {DIFFICULTY[room.difficulty].example}</div>
        </div>
        <div className={styles.start}>
          {isHost ? (
            <>
              <button className={`btn btn--lg ${full ? 'btn--primary btn--ready' : ''}`} disabled={!full}
                onClick={() => session.send({ type: 'start' })}>
                Начать игру
              </button>
              <div className="t-small">Роли раздадутся случайно, когда соберутся все трое</div>
            </>
          ) : (
            <div className="t-small">Хост начнёт игру, когда соберутся все трое</div>
          )}
        </div>
      </div>
    </main>
  );
}
