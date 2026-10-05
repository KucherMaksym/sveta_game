'use client';

import { useEffect, useState } from 'react';
import { parseRoomCode } from '@/lib/net/room-code';
import styles from './join.module.css';

const NAME_KEY = 'sgn-name';

type Props =
  | { invite?: undefined; onCreate: (name: string) => void; onJoin: (name: string, code: string) => void }
  | { invite: string; onCreate?: undefined; onJoin: (name: string, code: string) => void };

/** The landing screen: create a room, or join one by code or by invite link. */
export function JoinScreen({ invite, onCreate, onJoin }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? '');
    } catch {}
  }, []);

  function withName(fn: (name: string) => void) {
    const n = name.trim();
    if (!n) {
      setError('Сначала представься');
      document.getElementById('name')?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
    fn(n);
  }

  function joinByCode() {
    const parsed = parseRoomCode(code);
    if (!parsed) return setError('Код выглядит как ABCD-12');
    withName((n) => onJoin(n, parsed));
  }

  return (
    <main className="page">
      <div className={styles.home}>
        <div className={styles.hero}>
          <h1 className={styles.titleStack} aria-label="Слепой, Глухой, Немой">
            <span className="bg-blind">Слепой,</span>
            <span className="bg-deaf">Глухой,</span>
            <span className="bg-mute">Немой</span>
          </h1>
          <p className="t-lead enter enter-4">Игра на троих. Один не говорит, другой не слышит, третий не видит. Вместе — угадайте загадку.</p>
        </div>

        <form className={`card ${styles.card} enter enter-2`} onSubmit={(e) => {
          e.preventDefault();
          if (invite) withName((n) => onJoin(n, invite));
          else withName(onCreate!);
        }}>
          <h2 className="t-h2">{invite ? 'Тебя позвали играть' : 'Новая игра'}</h2>
          {invite && <div className={styles.invite}>Комната <span className="room-code">{invite}</span></div>}
          <div className="field">
            <label htmlFor="name">Твоё имя</label>
            <input className="input" id="name" value={name} maxLength={20} autoComplete="off" placeholder="Как тебя зовут?"
              onChange={(e) => { setName(e.target.value); setError(''); }} />
          </div>
          <button className="btn btn--primary btn--lg btn--block">{invite ? 'Войти в комнату' : 'Создать комнату'}</button>
          {!invite && (
            <>
              <div className="divider">или по коду</div>
              <div className={styles.joinRow}>
                <input className="input input--code" placeholder="____-__" maxLength={40} aria-label="Код комнаты"
                  value={code} onChange={(e) => { setCode(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), joinByCode())} />
                <button type="button" className="btn" onClick={joinByCode}>Войти</button>
              </div>
            </>
          )}
          {error ? <div className="t-error pop">{error}</div> : <div className="t-small">Понадобятся камера, микрофон и звук</div>}
        </form>
      </div>
    </main>
  );
}
