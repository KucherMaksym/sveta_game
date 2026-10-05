import type { Metadata } from 'next';
import { Room } from '@/components/room';
import { Problem } from '@/components/screens/status';
import { parseRoomCode } from '@/lib/net/room-code';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = parseRoomCode((await params).code);
  return { title: code ? `Комната ${code} · Слепой, Глухой, Немой` : 'Слепой, Глухой, Немой' };
}

export default async function Page({ params }: Props) {
  const code = parseRoomCode((await params).code);
  if (!code) return <Problem title="Такой комнаты нет" text="В ссылке ошибка. Попроси у друга новую или создай свою игру." />;
  return <Room code={code} />;
}
