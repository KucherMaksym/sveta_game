'use client';

import { playerByRole } from '@/lib/game/rules';
import { useGame } from '../game-context';
import { PlayerTile } from '../ui/media';
import { PlayerTag } from '../ui/role';
import { TopBar } from './shell';
import { Waiting } from './waiting';
import styles from './rounds.module.css';

/** Turn 1: the mute acts the secret out, the deaf watches. The blind waits. */
export function MimeScreen() {
  const { session, room, me } = useGame();
  const mute = playerByRole(room, 'mute');
  const deaf = playerByRole(room, 'deaf');
  const blind = playerByRole(room, 'blind');

  if (me.role === 'blind') {
    return <Waiting pair={['mute', 'deaf']} text="Немой показывает загадку Глухому. Ты их не видишь и не слышишь — скоро твой ход." />;
  }

  const isMute = me.role === 'mute';
  const partner = isMute ? deaf : mute;
  return (
    <main className="page page--fit">
      <TopBar />
      <div className="game">
        <PlayerTile of={partner!.id} player={partner} ring={partner!.role} className={`${styles.stage} enter enter-1`}
          placeholder={isMute ? 'камера Глухого' : 'камера Немого — пантомима'} />
        <div className="col">
          <PlayerTile of="self" player={me} className="enter enter-2" placeholder="твоя камера" />
          {isMute && room.secret && (
            <div className="card card--flat secret-card enter enter-2">
              <span className="t-mono">загадка · только для тебя</span>
              <b>{room.secret}</b>
            </div>
          )}
          <div className="waiting enter enter-3">
            <PlayerTag player={blind} />
            Сидит за дверью и вас не слышит
          </div>
          <div className={`hint bg-${me.role} push-down enter enter-4`}>
            {isMute
              ? 'Показывай загадку руками и лицом. Глухой тебя видит, ты его видишь и слышишь.'
              : 'Смотри в оба. Потом тебе объяснять это Слепому — словами, но не называя.'}
          </div>
          <button className="btn btn--primary btn--block enter enter-4" onClick={() => session.send({ type: 'next' })}>
            {isMute ? 'Глухой понял — дальше' : 'Я понял — дальше'}
          </button>
        </div>
      </div>
    </main>
  );
}
