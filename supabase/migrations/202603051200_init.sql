create extension if not exists "pgcrypto";

-- Arcade-style leaderboard: each submission is a row (duplicates allowed)
create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  season_id text not null default 'alpha',
  heat int not null check (heat >= 0),
  kills int not null default 0 check (kills >= 0),
  display_name text not null,
  character_id text not null default 'UNKNOWN',
  created_at timestamptz not null default now()
);

-- Forward migration safety for existing installs
alter table public.leaderboard_entries
  add column if not exists season_id text;

alter table public.leaderboard_entries
  add column if not exists heat int;

alter table public.leaderboard_entries
  add column if not exists kills int;

alter table public.leaderboard_entries
  add column if not exists display_name text;

alter table public.leaderboard_entries
  add column if not exists character_id text;

alter table public.leaderboard_entries
  add column if not exists created_at timestamptz;

update public.leaderboard_entries
set season_id = 'alpha'
where season_id is null;

update public.leaderboard_entries
set heat = 0
where heat is null;

update public.leaderboard_entries
set kills = 0
where kills is null;

update public.leaderboard_entries
set display_name = 'PLAYER'
where display_name is null or btrim(display_name) = '';

update public.leaderboard_entries
set character_id = 'UNKNOWN'
where character_id is null;

update public.leaderboard_entries
set created_at = now()
where created_at is null;

alter table public.leaderboard_entries
  alter column season_id set default 'alpha';

alter table public.leaderboard_entries
  alter column season_id set not null;

alter table public.leaderboard_entries
  alter column heat set default 0;

alter table public.leaderboard_entries
  alter column heat set not null;

alter table public.leaderboard_entries
  alter column kills set default 0;

alter table public.leaderboard_entries
  alter column kills set not null;

alter table public.leaderboard_entries
  alter column display_name set not null;

alter table public.leaderboard_entries
  alter column character_id set default 'UNKNOWN';

alter table public.leaderboard_entries
  alter column character_id set not null;

alter table public.leaderboard_entries
  alter column created_at set default now();

alter table public.leaderboard_entries
  alter column created_at set not null;

-- Stable ranking index
create index if not exists leaderboard_entries_rank_idx
  on public.leaderboard_entries
  (season_id, heat desc, kills desc, created_at asc, id asc);

-- Preview returns: computed rank + top list + around-you slice
create or replace function public.leaderboard_preview(
  p_season_id text,
  p_heat int,
  p_kills int,
  p_top_limit int default 20,
  p_window int default 6
)
returns jsonb
language plpgsql
as $$
declare
  v_rank int;
  v_top jsonb;
  v_around jsonb;
begin
  -- Rank = number of rows strictly better + 1
  select 1 + count(*) into v_rank
  from public.leaderboard_entries e
  where e.season_id = p_season_id
    and (
      (e.heat > p_heat)
      or (e.heat = p_heat and e.kills > p_kills)
    );

  -- Top list
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_top
  from (
    select
      row_number() over (
        order by heat desc, kills desc, created_at asc, id asc
      ) as rank,
      display_name,
      heat,
      kills,
      character_id
    from public.leaderboard_entries
    where season_id = p_season_id
    order by heat desc, kills desc, created_at asc, id asc
    limit greatest(1, p_top_limit)
  ) t;

  -- Around slice (public entries only)
  with ranked as (
    select
      row_number() over (
        order by heat desc, kills desc, created_at asc, id asc
      ) as rank,
      display_name,
      heat,
      kills,
      character_id
    from public.leaderboard_entries
    where season_id = p_season_id
  )
  select coalesce(jsonb_agg(to_jsonb(a) order by a.rank), '[]'::jsonb) into v_around
  from (
    select *
    from ranked
    where rank between greatest(1, v_rank - p_window) and (v_rank + p_window)
    order by rank
  ) a;

  return jsonb_build_object(
    'seasonId', p_season_id,
    'rank', v_rank,
    'top', v_top,
    'around', v_around
  );
end;
$$;

alter table public.leaderboard_entries enable row level security;

-- Public read
drop policy if exists "leaderboard_select_public" on public.leaderboard_entries;
create policy "leaderboard_select_public"
on public.leaderboard_entries
for select
to anon, authenticated
using (true);

-- Public insert, with sanity checks
drop policy if exists "leaderboard_insert_public" on public.leaderboard_entries;
create policy "leaderboard_insert_public"
on public.leaderboard_entries
for insert
to anon, authenticated
with check (
  season_id = 'alpha'
  and heat between 0 and 100000
  and kills between 0 and 2000000000
  and char_length(display_name) between 1 and 12
  and display_name ~ '^[A-Za-z0-9 _\\-]+$'
  and char_length(character_id) between 3 and 24
  and character_id ~ '^[A-Z][A-Z0-9_]*$'
);

-- Block client updates/deletes
revoke update, delete on public.leaderboard_entries from anon, authenticated;
