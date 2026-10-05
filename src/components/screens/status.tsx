import Link from 'next/link';

export function Connecting({ text = 'Подключаемся к комнате' }: { text?: string }) {
  return (
    <main className="page page--dark page--center" style={{ gap: 22 }}>
      <div className="spinner" style={{ color: 'var(--blind)' }} />
      <h1 className="t-h2 enter">{text}…</h1>
      <p className="t-small enter enter-1" style={{ color: 'var(--muted-line)' }}>Разреши доступ к камере и микрофону, если браузер спросит</p>
    </main>
  );
}

export function Problem({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <main className="page page--center">
      <div className="card pop" style={{ maxWidth: 480 }}>
        <div className="role-badge role-badge--lg bg-mute">!</div>
        <h1 className="t-h2">{title}</h1>
        <p className="t-lead" style={{ fontSize: 17 }}>{text}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {onRetry && <button className="btn btn--primary" onClick={onRetry}>Попробовать снова</button>}
          <Link className="btn" href="/">На главную</Link>
        </div>
      </div>
    </main>
  );
}
