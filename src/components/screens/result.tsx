'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { ROLES } from '@/lib/game/rules';
import { logEvent } from '@/lib/log';
import { useGame } from '../game-context';
import { Board } from '../ui/board';
import { Confetti } from '../ui/confetti';
import { roleBg } from '../ui/role';
import styles from './result.module.css';

/** Saves the finished round to a signed-in player's history. Guests play without it. */
function useRecordRound() {
  const { room, me } = useGame();
  const { data: account, isPending } = authClient.useSession();
  const [saved, setSaved] = useState(false);
  const userId = account?.user.id;

  // Every player, guest or not, logs the round once.
  useEffect(() => {
    if (!room.revealEndsAt) return;
    logEvent('round', me.name, room.id, {
      roundId: room.revealEndsAt,
      role: me.role,
      difficulty: room.difficulty,
      level: room.level,
      secret: room.secret,
      won: room.won,
      guesses: room.guesses,
      questions: room.answers.length,
      team: room.players.map((p) => ({ name: p.name, role: p.role })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.revealEndsAt]);

  useEffect(() => {
    if (!userId || !me.role || !room.revealEndsAt || !room.secret) return;
    fetch('/api/games', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        room: room.id,
        roundId: room.revealEndsAt,
        role: me.role,
        difficulty: room.difficulty,
        secret: room.secret,
        won: room.won,
        guess: room.guesses.at(-1) ?? null,
        questions: room.answers.length,
        team: room.players.map((p) => ({ name: p.name, role: p.role })),
      }),
    }).then((r) => setSaved(r.ok), () => {});
    // One request per round; the server ignores repeats anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, room.revealEndsAt]);

  return isPending ? null : saved ? 'saved' : userId ? null : 'guest';
}

export function ResultScreen() {
  const { session, room, isHost } = useGame();
  const last = room.guesses.at(-1);
  const record = useRecordRound();
  return (
    <main className={`page ${room.won ? 'page--action' : 'page--dark'}`}>
      {room.won && <Confetti />}
      <div className={styles.result}>
        <div className="col" style={{ gap: 24 }}>
          <h1 className={`t-event ${styles.title}`}>{room.won ? 'Угадали!' : 'Не угадали'}</h1>
          <div className={`card ${styles.card} enter enter-2`}>
            <div className={styles.line}><span className="t-mono">загадка</span><b>{room.secret}</b></div>
            {last && (
              <>
                <hr />
                <div className={styles.line}><span className="t-mono">ответ Слепого</span><b>{last}</b></div>
              </>
            )}
            <span className={`chip ${room.won ? 'bg-ok' : 'bg-mute'} ${styles.verdict}`}>
              {room.won ? 'засчитано · смысл совпал' : 'в этот раз не вышло'}
            </span>
          </div>
          {isHost ? (
            <div className={`${styles.actions} enter enter-3`}>
              <button className="btn btn--yellow" onClick={() => session.send({ type: 'start' })}>Ещё раунд</button>
              <button className="btn" onClick={() => session.send({ type: 'lobby' })}>В лобби</button>
            </div>
          ) : (
            <div className={`${styles.note} enter enter-3`}>Хост решает, играть ли ещё раунд</div>
          )}
          <div className={`${styles.note} enter enter-4`}>В новом раунде роли перемешаются</div>
          {record === 'saved' && <div className={`${styles.note} pop`}>Раунд записан в <a className="link" href="/profile" target="_blank">твою историю</a></div>}
          {record === 'guest' && (
            <div className={`${styles.note} pop`}>
              Ты играешь как гость. <a className="link" href="/login?next=/profile" target="_blank">Войди</a>, чтобы копить статистику
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 20 }}>
          <Board className={`${styles.drawing} enter enter-2`} />
          <div className={styles.scores}>
            {room.players.map((p, i) => (
              <div key={p.id} className={`${roleBg(p.role)} pop`} style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                {p.name}
                <span>{p.role ? ROLES[p.role].title : ''} · ★ {p.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
