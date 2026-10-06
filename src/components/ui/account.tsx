'use client';

import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

/** "Войти" for guests, the player's name (→ profile) once signed in. */
export function AccountLink({ next }: { next?: string }) {
  const { data, isPending } = authClient.useSession();
  if (isPending) return null;
  if (data) return <Link className="chip" href="/profile" style={{ fontSize: 14, padding: '7px 14px' }}>{data.user.name} · профиль</Link>;
  return <Link className="link" href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Войти</Link>;
}
