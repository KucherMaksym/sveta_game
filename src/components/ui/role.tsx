import { CHANNEL_LABEL, ROLES, type Channel } from '@/lib/game/rules';
import type { PublicPlayer, Role } from '@/lib/game/types';

export const roleBg = (role: Role | null) => (role ? `bg-${role}` : 'bg-card');

export function RoleBadge({ role, large }: { role: Role; large?: boolean }) {
  return <div className={`role-badge${large ? ' role-badge--lg' : ''}`}>{ROLES[role].letter}</div>;
}

/** "Света · Немой" label in the role's color. */
export function PlayerTag({ player, you, className = '' }: { player?: PublicPlayer; you?: boolean; className?: string }) {
  if (!player) return null;
  const role = player.role ? ROLES[player.role].title : null;
  const text = you ? `${player.name} (ты)` : [player.name, role].filter(Boolean).join(' · ');
  return <span className={`tag ${roleBg(player.role)} ${className}`}>{text}</span>;
}

const ORDER: Channel[] = ['camera', 'mic', 'sound'];

/** What a role takes away goes first, struck through on ink; the rest are plain. */
export function RoleChips({ role }: { role: Role }) {
  const off = ROLES[role].off;
  return (
    <div className="chips">
      {[off, ...ORDER.filter((c) => c !== off)].map((c) => (
        <span key={c} className={`chip${c === off ? ' chip--off' : ''}`}>{CHANNEL_LABEL[c]}</span>
      ))}
    </div>
  );
}

/** Live status of my own channels, with a green dot for what works. */
export function ChannelStatus({ channels }: { channels: Record<Channel, boolean> }) {
  return (
    <div className="chips">
      {ORDER.map((c) => (
        <span key={c} className={`chip ${channels[c] ? 'chip--dot' : 'chip--off'}`}>{CHANNEL_LABEL[c]}</span>
      ))}
    </div>
  );
}
