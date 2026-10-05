'use client';

import { ROLES } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { Board } from '../ui/board';
import { Confetti } from '../ui/confetti';
import { AudioSink } from '../ui/media';
import { roleBg } from '../ui/role';
import styles from './result.module.css';

export function ResultScreen() {
  const { session, room, isHost } = useGame();
  const last = room.guesses.at(-1);
  return (
    <main className={`page ${room.won ? 'page--action' : 'page--dark'}`}>
      <AudioSink />
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
