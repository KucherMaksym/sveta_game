import { headers } from 'next/headers';
import { auth } from '@/lib/server/auth';
import { parseRecord, saveGame } from '@/lib/server/games';

/** A signed-in player reports a finished round from their own point of view. */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: 'Нужно войти' }, { status: 401 });
  const record = parseRecord(await req.json().catch(() => null));
  if (!record) return Response.json({ error: 'Неверные данные' }, { status: 400 });
  await saveGame(session.user.id, record);
  return Response.json({ ok: true });
}
