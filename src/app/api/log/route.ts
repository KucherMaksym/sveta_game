import { headers } from 'next/headers';
import { auth } from '@/lib/server/auth';
import { parseLog, requestOrigin, saveLog } from '@/lib/server/logs';

/** Any player, guest or signed in, reports what happened in their browser. */
export async function POST(req: Request) {
  const log = parseLog(await req.json().catch(() => null));
  if (!log) return Response.json({ error: 'Неверные данные' }, { status: 400 });
  const h = await headers();
  const session = await auth.api.getSession({ headers: h }).catch(() => null);
  await saveLog(log, requestOrigin(h), session?.user.id ?? null);
  return Response.json({ ok: true });
}
