'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { DIFFICULTY, ROLES } from '@/lib/game/rules';
import type { Difficulty, Role } from '@/lib/game/types';
import type { HistoryItem, Stats } from '@/lib/server/games';
import { RoleBadge, roleBg } from './ui/role';
import styles from './profile.module.css';

const percent = ({ played, won }: { played: number; won: number }) => (played ? `${Math.round((won / played) * 100)}%` : '—');

const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Props = { name: string; email: string; stats: Stats; history: HistoryItem[] };

export function Profile({ name, email, stats, history }: Props) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <main className={`page ${styles.page}`}>
      <header className="topbar enter">
        <Link className="logo" href="/">С·Г·Н</Link>
        <div className={styles.me}>
          <span className="t-small">{email}</span>
          <button className="btn btn--sm" onClick={signOut}>Выйти</button>
        </div>
      </header>

      <div className={`${styles.head} enter enter-1`}>
        <h1 className="t-h1">{name}</h1>
        <Link className="btn btn--primary" href="/">Играть</Link>
      </div>

      <section className={`${styles.totals} enter enter-2`}>
        <div className={`card card--flat ${styles.total}`}><b>{stats.played}</b><span>сыграно раундов</span></div>
        <div className={`card card--flat ${styles.total} bg-ok`}><b>{stats.won}</b><span>угадано</span></div>
        <div className={`card card--flat ${styles.total} bg-blind`}><b>{percent(stats)}</b><span>побед</span></div>
      </section>

      <section className={`${styles.split} enter enter-3`}>
        <div className="card">
          <h2 className="t-h3">По ролям</h2>
          {(Object.keys(ROLES) as Role[]).map((r) => (
            <div key={r} className={styles.row}>
              <span className={`${styles.roleName} ${roleBg(r)}`}><RoleBadge role={r} /> {ROLES[r].title}</span>
              <span className="t-mono">{stats.byRole[r].won} из {stats.byRole[r].played} · {percent(stats.byRole[r])}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="t-h3">По сложности</h2>
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <div key={d} className={styles.row}>
              <b>{DIFFICULTY[d].label}</b>
              <span className="t-mono">{stats.byDifficulty[d].won} из {stats.byDifficulty[d].played} · {percent(stats.byDifficulty[d])}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`card ${styles.history} enter enter-4`}>
        <h2 className="t-h3">История</h2>
        {history.length === 0 && (
          <div className="waiting">Пока пусто. Сыграй раунд, и он появится здесь.</div>
        )}
        {history.map((g) => (
          <article key={`${g.room}-${g.roundId}`} className={styles.game}>
            <span className={`tag ${roleBg(g.role)}`}>{ROLES[g.role].title}</span>
            <div className={styles.gameMain}>
              <b>{g.secret}</b>
              <span className="t-small">
                {g.guess && g.guess !== g.secret ? `ответ: «${g.guess}» · ` : ''}
                {DIFFICULTY[g.difficulty].label.toLowerCase()} · вопросов: {g.questions} · команда: {g.team.filter((p) => p.role !== g.role).map((p) => p.name).join(', ')}
              </span>
            </div>
            <div className={styles.gameSide}>
              <span className={`chip ${g.won ? 'bg-ok' : 'bg-mute'}`}>{g.won ? 'угадали' : 'не угадали'}</span>
              <span className="t-mono">{date.format(new Date(g.playedAt))}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
