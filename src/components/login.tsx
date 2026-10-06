'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import styles from './login.module.css';

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Неверная почта или пароль',
  USER_ALREADY_EXISTS: 'Аккаунт с этой почтой уже есть. Войди в него',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Аккаунт с этой почтой уже есть. Войди в него',
  PASSWORD_TOO_SHORT: 'Пароль слишком короткий: нужно хотя бы 6 символов',
  INVALID_EMAIL: 'Почта выглядит неправильно',
};

export function LoginForm({ next, google }: { next: string; google: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = mode === 'in'
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0] });
    setBusy(false);
    if (error) return setError(ERRORS[error.code ?? ''] ?? error.message ?? 'Не получилось. Попробуй ещё раз');
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="page">
      <header className="topbar enter">
        <Link className="logo" href="/">С·Г·Н</Link>
      </header>
      <div className={styles.wrap}>
        <form className={`card ${styles.card} pop`} onSubmit={submit}>
          <h1 className="t-h2">{mode === 'in' ? 'Вход' : 'Новый аккаунт'}</h1>
          <p className="t-small">Аккаунт нужен только для истории игр и статистики. Играть можно и без него.</p>

          {google && (
            <>
              <button type="button" className="btn btn--block" disabled={busy}
                onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}>
                Войти через Google
              </button>
              <div className="divider">или по почте</div>
            </>
          )}

          {mode === 'up' && (
            <div className="field">
              <label htmlFor="name">Имя</label>
              <input className="input" id="name" value={name} maxLength={20} autoComplete="nickname"
                placeholder="Как тебя зовут?" onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Почта</label>
            <input className="input" id="email" type="email" required value={email} autoComplete="email"
              onChange={(e) => { setEmail(e.target.value); setError(''); }} />
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <input className="input" id="password" type="password" required minLength={6} value={password}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              onChange={(e) => { setPassword(e.target.value); setError(''); }} />
          </div>
          <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {mode === 'in' ? 'Войти' : 'Создать аккаунт'}
          </button>
          {error && <div className="t-error pop">{error}</div>}

          <div className={styles.links}>
            <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>
              {mode === 'in' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
            </button>
            <Link className="link" href={next}>Играть как гость</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
