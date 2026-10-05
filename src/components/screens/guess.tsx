'use client';

import { useState } from 'react';
import { playerByRole } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { Board } from '../ui/board';
import { AudioSink, PlayerTile } from '../ui/media';
import { TopBar } from './shell';
import styles from './rounds.module.css';

function Answers({ note }: { note: string }) {
  const { room } = useGame();
  return (
    <div className={`card card--flat ${styles.answers} enter enter-2`}>
      <h2 className="t-h3">Ответы</h2>
      <div className="qa-list">
        {room.answers.length === 0 && <div className="t-small">Пока ни одного вопроса</div>}
        {/* Newest first: the latest answer is the one that matters right now. */}
        {room.answers.map((a, i) => ({ a, n: i + 1 })).reverse().map(({ a, n }) => (
          <div key={n} className="qa">
            Вопрос {n}
            <span className={`chip ${a === 'yes' ? 'bg-ok' : 'bg-mute'}`}>{a === 'yes' ? 'да' : 'нет'}</span>
          </div>
        ))}
      </div>
      <div className="t-small push-down" style={{ fontSize: 12 }}>{note}</div>
    </div>
  );
}

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
        <AudioSink />
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
            <Answers note="Глухой отмечает ответы, тебе их зачитывают" />
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
        <AudioSink />
        <div className="game game--wide-side">
          <PlayerTile of={mute!.id} player={mute} ring="mute" className={`${styles.stage} enter enter-1`}
            placeholder="камера Немого — смотри, кивает ли он" />
          <div className="col" style={{ gap: 14, overflowY: 'auto', paddingRight: 8, paddingBottom: 8 }}>
            <div className="card card--flat enter enter-2">
              <h2 className="t-h3">Немой кивнул?</h2>
              <div className={styles.yesno}>
                <button className="btn bg-ok" onClick={() => session.send({ type: 'answer', value: 'yes' })}>Да</button>
                <button className="btn bg-mute" onClick={() => session.send({ type: 'answer', value: 'no' })}>Нет</button>
              </div>
            </div>
            <Answers note="Скажи ответ Слепому вслух и отметь его здесь" />
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
      <AudioSink />
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
          <PlayerTile of={deaf!.id} player={deaf} ring="deaf" className="enter enter-1" />
          <PlayerTile of={blind!.id} player={blind} ring="blind" className="enter enter-2" />
          <Guesses canAccept />
          <Answers note="Что Глухой передал Слепому" />
        </div>
      </div>
    </main>
  );
}
