'use client';

import { useEffect, useState } from 'react';
import { STEPS } from '@/lib/game/rules';
import type { Phase } from '@/lib/game/types';

export function Steps({ phase }: { phase: Phase }) {
  const current = STEPS.findIndex((s) => s.phase === phase);
  return (
    <ol className="steps">
      {STEPS.map((s, i) => (
        <li key={s.phase} className={i < current ? 'done' : i === current ? 'now' : ''}>{s.label}</li>
      ))}
    </ol>
  );
}

/**
 * Whole seconds left until `endsAt`, a moment on the host's clock. `offset` converts my clock to
 * the host's, so every player counts down to the same instant whatever their own clock says.
 */
export function useCountdown(endsAt: number | null, offset: number) {
  const left = () => (endsAt ? Math.max(0, Math.ceil((endsAt - Date.now() - offset) / 1000)) : 0);
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    setSeconds(left());
    if (!endsAt) return;
    const id = setInterval(() => {
      const s = left();
      setSeconds(s);
      if (!s) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, offset]);
  return seconds;
}

export function Timer({ endsAt, offset }: { endsAt: number; offset: number }) {
  const left = useCountdown(endsAt, offset);
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return <div className={`timer${left <= 10 ? ' timer--hot' : ''}`} role="timer">{text}</div>;
}
