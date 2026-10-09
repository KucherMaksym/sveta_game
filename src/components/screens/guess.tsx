'use client';

import { useState } from 'react';
import { playerByRole } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { Board } from '../ui/board';
import { PlayerTile } from '../ui/media';
import { TopBar } from './shell';
import styles from './rounds.module.css';

function Guesses({ canAccept }: { canAccept?: boolean }) {
  const { session, room } = useGame();
  if (!room.guesses.length) return null;
  return (
    <div className="card card--flat enter enter-3">
      <h2 className="t-h3">Попытки Слепого</h2>
      {room.guesses.map((g, i) => (
        <div key={i} className="qa">
          {g}
          {canAccept && i === room.guesses.length - 1 && (
            <button className="btn btn--sm bg-ok" onClick={() => session.send({ type: 'accept' })}>Засчитать</button>
          )}
        </div>
      ))}
    </div>
  );
}

function GuessForm() {
  const { session } = useGame();
  const [text, setText] = useState('');
  return (
    <form className={`card card--flat bg-blind ${styles.guessForm} enter enter-3`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        session.send({ type: 'guess', text });
        setText('');
      }}>
      <h2 className="t-h3">Я знаю ответ!</h2>
      <div className={styles.answerRow}>
        <input className="input" placeholder="впиши догадку" value={text} onChange={(e) => setText(e.target.value)}
          maxLength={100} autoComplete="off" />
        <button className="btn btn--primary">Отправить</button>
      </div>
    </form>
  );
}

/** My own camera in the corner of my partner's tile, so I know they see me. */
function SelfView() {
  const { me } = useGame();
  return <PlayerTile of="self" player={me} className={styles.pip} placeholder="твоя камера" />;
}

/** Turn 3: the blind asks yes/no questions aloud, the mute nods, the deaf relays the answer. */
export function GuessScreen() {
  const { session, room, me } = useGame();
  const mute = playerByRole(room, 'mute');
  const deaf = playerByRole(room, 'deaf');
  const blind = playerByRole(room, 'blind');

  if (me.role === 'blind') {
    return (
      <main className="page page--fit">
        <TopBar />
        <div className="game game--wide-side">
          <div className="col" style={{ gap: 14 }}>
            <Board className="enter enter-1"><div className="sticker bg-blind">Ого, это ты нарисовал?</div></Board>
            <div className={`${styles.flow} enter enter-2`}>
              <span className="tag bg-blind">Ты спрашиваешь вслух</span>→
              <span className="tag bg-mute">Немой кивает</span>→
              <span className="tag bg-deaf">Глухой говорит ответ</span>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <Guesses />
            <GuessForm />
            <button className="link" style={{ alignSelf: 'center' }} onClick={() => session.send({ type: 'giveup' })}>Сдаёмся</button>
          </div>
        </div>
      </main>
    );
  }

  if (me.role === 'deaf') {
    return (
      <main className="page page--fit">
        <TopBar />
        <div className="game game--wide-side">
          <PlayerTile of={mute!.id} player={mute} ring="mute" className={`${styles.stage} enter enter-1`}
            placeholder="камера Немого — смотри, кивает ли он">
            <SelfView />
          </PlayerTile>
          <div className="col" style={{ gap: 14, overflowY: 'auto', paddingRight: 8, paddingBottom: 8 }}>
            <Board className={`${styles.miniBoard} enter enter-3`} />
            <Guesses />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page page--fit">
      <TopBar />
      <div className="game game--wide-side">
        <div className="col" style={{ gap: 14 }}>
          <Board className="enter enter-1">
            {room.secret && <div className="sticker bg-mute">Загадано: {room.secret}</div>}
          </Board>
          <div className={`hint bg-mute enter enter-2`}>
            Слушай вопросы Слепого и кивай или мотай головой — Глухой переведёт. Если догадка почти верная, засчитай её.
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <PlayerTile of={deaf!.id} player={deaf} ring="deaf" className="enter enter-1">
            <SelfView />
          </PlayerTile>
          <PlayerTile of={blind!.id} player={blind} ring="blind" className="enter enter-2" />
          <Guesses canAccept />
        </div>
      </div>
    </main>
  );
}
