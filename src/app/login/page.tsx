import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login';
import { auth, hasGoogle } from '@/lib/server/auth';

export const metadata: Metadata = { title: 'Вход · Слепой, Глухой, Немой' };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function Page({ searchParams }: Props) {
  const { next } = await searchParams;
  // Only our own pages: never bounce a player to someone else's site.
  const to = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (await auth.api.getSession({ headers: await headers() })) redirect(to);
  return <LoginForm next={to} google={hasGoogle} />;
}
