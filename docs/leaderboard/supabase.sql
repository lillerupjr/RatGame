create extension if not exists "pgcrypto";

-- Arcade-style leaderboard: each submission is a row (duplicates allowed)
create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  season_id text not null default 'alpha',
  depth int not null check (depth >= 0),
  kills int not null default 0 check (kills >= 0),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Stable ranking index
create index if not exists leaderboard_entries_rank_idx
  on public.leaderboard_entries
  (season_id, depth desc, kills desc, created_at asc, id asc);

-- Preview returns: computed rank + top list + around-you slice
create or replace function public.leaderboard_preview(
  p_season_id text,
  p_depth int,
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
      (e.depth > p_depth)
      or (e.depth = p_depth and e.kills > p_kills)
    );

  -- Top list
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_top
  from (
    select
      row_number() over (
        order by depth desc, kills desc, created_at asc, id asc
      ) as rank,
      display_name,
      depth,
      kills
    from public.leaderboard_entries
    where season_id = p_season_id
    order by depth desc, kills desc, created_at asc, id asc
    limit greatest(1, p_top_limit)
  ) t;

  -- Around slice (public entries only)
  with ranked as (
    select
      row_number() over (
        order by depth desc, kills desc, created_at asc, id asc
      ) as rank,
      display_name,
      depth,
      kills
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
  and depth between 0 and 100000
  and kills between 0 and 2000000000
  and char_length(display_name) between 1 and 12
  and display_name ~ '^[A-Za-z0-9 _\\-]+$'
);

-- Block client updates/deletes
revoke update, delete on public.leaderboard_entries from anon, authenticated;
