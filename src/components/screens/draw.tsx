'use client';

import { useState } from 'react';
import { BRUSHES, playerByRole } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { Board, Toolbar } from '../ui/board';
import { PlayerTile } from '../ui/media';
import { PlayerTag } from '../ui/role';
import { TopBar } from './shell';

/** Turn 2: the deaf describes in words, the blind draws without seeing. The mute silently watches the blind. */
export function DrawScreen() {
  const { session, room, me } = useGame();
  const [color, setColor] = useState(0);
  const [brush, setBrush] = useState(BRUSHES[1]);
  const deaf = playerByRole(room, 'deaf');
  const blind = playerByRole(room, 'blind');
  const mute = playerByRole(room, 'mute');

  if (me.role === 'mute') {
    return (
      <main className="page page--fit">
        <TopBar />
        <div className="game">
          <Board className="enter enter-1" />
          <div className="col">
            <PlayerTile of={blind!.id} player={blind} ring="blind" className="enter enter-2" placeholder="камера Слепого" />
            <div className="waiting enter enter-3">
              <PlayerTag player={deaf} />
              Объясняет Слепому, что рисовать. Ты их не слышишь
            </div>
            <div className="hint bg-mute push-down enter enter-4">
              Смотри, как Слепой рисует. Скоро твой ход: будешь кивать или мотать головой.
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isBlind = me.role === 'blind';
  return (
    <main className="page page--fit">
      <TopBar />
      <div className="game">
        <div className="col" style={{ gap: 16 }}>
          <Board blindfold={isBlind} color={color} brush={brush} className="enter enter-1" />
          {isBlind && (
            <div className="enter enter-2" style={{ alignSelf: 'center' }}>
              <Toolbar color={color} brush={brush} onColor={setColor} onBrush={setBrush}
                onClear={() => session.send({ type: 'clear' })} />
            </div>
          )}
        </div>
        <div className="col">
          {isBlind ? (
            <PlayerTile of={deaf!.id} player={deaf} ring="deaf" className="enter enter-2" />
          ) : (
            <div className="waiting enter enter-2">
              <PlayerTag player={blind} />
              Рисует вслепую. Ты видишь каждую линию, но не слышишь его
            </div>
          )}
          <div className="waiting enter enter-3">
            <PlayerTag player={mute} />
            {isBlind ? 'Молча смотрит, как ты рисуешь' : 'Молча смотрит, как рисует Слепой'}
          </div>
          <div className={`hint bg-${me.role} push-down enter enter-4`}>
            {isBlind
              ? 'Слушай Глухого и води пальцем или мышкой. Криво — это нормально.'
              : 'Говори Слепому, что и где рисовать, но не называй загаданные слова.'}
          </div>
          <button className="btn btn--primary btn--block enter enter-4" onClick={() => session.send({ type: 'next' })}>
            {isBlind ? 'Готово!' : 'Рисунок готов — дальше'}
          </button>
        </div>
      </div>
    </main>
  );
}
