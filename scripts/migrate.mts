// Creates or updates the tables: Better Auth's own, then ours.
// Run with `npm run db:migrate` (reads DATABASE_URL from .env.local).
import { getMigrations } from 'better-auth/db/migration';

if (!process.env.DATABASE_URL) {
  console.error('Нет DATABASE_URL. Подключи базу к проекту в Vercel и выполни `vercel env pull .env.local`.');
  process.exit(1);
}

const { auth, db } = await import('../src/lib/server/auth.ts');

const { runMigrations } = await getMigrations(auth.options);
await runMigrations();

await db.query(`
  create table if not exists game (
    id bigserial primary key,
    user_id text not null references "user"(id) on delete cascade,
    room text not null,
    -- the host's revealEndsAt: tells apart rounds of the same room
    round_id bigint not null,
    played_at timestamptz not null default now(),
    role text not null,
    difficulty text not null,
    secret text not null,
    won boolean not null,
    guess text,
    questions int not null,
    team jsonb not null,
    unique (user_id, room, round_id)
  );
  create index if not exists game_user_played on game (user_id, played_at desc);

  -- what happened in players' browsers, guests included; for later analysis
  create table if not exists event_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    event text not null,
    device_id text not null,
    user_id text references "user"(id) on delete set null,
    name text,
    room text,
    ip text,
    country text,
    region text,
    city text,
    lat double precision,
    lon double precision,
    user_agent text,
    data jsonb not null default '{}'
  );
  create index if not exists event_log_at on event_log (at desc);
  create index if not exists event_log_device on event_log (device_id, at desc);
`);

await db.end();
console.log('База готова');
