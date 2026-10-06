import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Profile } from '@/components/profile';
import { auth } from '@/lib/server/auth';
import { getHistory, getStats } from '@/lib/server/games';

export const metadata: Metadata = { title: 'Профиль · Слепой, Глухой, Немой' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login?next=/profile');
  const [stats, history] = await Promise.all([getStats(session.user.id), getHistory(session.user.id)]);
  return <Profile name={session.user.name} email={session.user.email} stats={stats} history={history} />;
}
