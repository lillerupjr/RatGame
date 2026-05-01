# Database

## Purpose

Own the repo database boundary: Supabase leaderboard persistence, preview/ranking semantics, runtime payload mapping, optional availability behavior, and migration/deploy flow.

## Scope

- Env discovery: `src/config/supabase.ts`, `src/vite-env.d.ts`
- Schema, rank index, preview RPC, RLS: `supabase/migrations/202603051200_init.sql`
- Live migration: `.github/workflows/pages-live.yml`
- Client preview/insert normalization: `src/leaderboard/leaderboardClient.ts`
- Runtime summary mapping and missing-env fallback: `src/game/game.ts`

## Non-scope

- End-screen layout/tabs/styling: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Run-heat internals beyond exported leaderboard fields: `docs/canonical/progression_objectives_rewards.md`
- Non-leaderboard persistence
- Supabase project creation/manual console setup outside repo files/workflows

## Entrypoints

- `src/config/supabase.ts`
- `src/vite-env.d.ts`
- `src/leaderboard/leaderboardClient.ts`
- `src/game/game.ts`
- `supabase/migrations/202603051200_init.sql`
- `.github/workflows/pages-live.yml`

## Pipeline

1. **Env**: `getSupabaseEnv()` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; missing values return `null` and no client is built.
2. **Summary**: `getEndRunSummary(world)` maps `heat` from `getRunHeat(world)`, `kills` from `world.kills`, and normalized `characterId` from `world.currentCharacterId`. This is the only runtime payload handed to the DB layer.
3. **Availability**: `game.ts` constructs `LeaderboardClient` only with env present. Missing env is non-fatal: preview falls back to local `YOU`, submission disables, status text names missing vars.
4. **Preview**: `loadEndLeaderboardPreview()` calls `LeaderboardClient.previewRun()`, which clamps inputs, calls `leaderboard_preview`, normalizes rows, and injects a client-only `YOU` row for around-you display. Rank authority remains server-side.
5. **Submit**: `submitEndLeaderboardName()` sanitizes display name and calls `submitName()`, inserting one `public.leaderboard_entries` row with `season_id`, `heat`, `kills`, `display_name`, `character_id`. Success reloads preview instead of guessing rank locally.
6. **Schema / Ranking**: migration defines append-only `leaderboard_entries`; stable order is `heat desc`, `kills desc`, `created_at asc`, `id asc`; `leaderboard_preview(...)` returns rank, top slice, around slice.
7. **Deploy**: schema changes live in `supabase/migrations/`; live-branch workflow links Supabase and runs `supabase db push`.

## Invariants

- The only repo-owned database surface today is Supabase leaderboard.
- Database env absence must not block startup or end-run flow.
- Browser writes are append-only inserts; client update/delete access is not part of the system.
- Runtime DB payload is limited to `heat`, `kills`, normalized `characterId`.
- `LeaderboardClient` defaults to season `alpha`; RLS also constrains public inserts to `season_id = 'alpha'`.
- Display names: `[A-Za-z0-9 _-]`, max length 12.
- Character ids are uppercased and must match pattern or become `UNKNOWN`.
- Ranking order is database-function/index-owned, not client-sorted.
- Schema changes live in `supabase/migrations/`; no duplicated SQL truth under `docs/`.

## Constraints

- Keep DB boundary narrow: Supabase schema/migration/client behavior only.
- Runtime must degrade cleanly when env is absent.
- UI may format ranking results but must not invent alternate rank rules.
- Client validation is UX only; constraints/RLS are final enforcement.
- Public browser access stays limited to preview reads and append-only leaderboard inserts.

## Dependencies

### Incoming

- World summary data from `src/game/game.ts`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- GitHub Actions secrets/vars for `.github/workflows/pages-live.yml`
- Supabase CLI against linked project

### Outgoing

- Preview payloads to end-run leaderboard UI
- Inserted rows in `public.leaderboard_entries`
- Schema/policy updates through `supabase db push`

## Extension

- New leaderboard fields require migration, RPC output, client types, runtime summary adapter, and UI consumption together.
- New seasons require explicit season config through runtime, client, and policies.
- New DB-backed features need separate tables/functions/contracts, not leaderboard overload.
- Deploy migration behavior extends through `.github/workflows/pages-live.yml`.

## Failure Modes

- Runtime payload changes without migration/RPC update cause insert/preview drift.
- Duplicated SQL under `docs/` becomes stale parallel truth.
- Relaxed client sanitization without policy changes causes avoidable submit failures.
- Client-side row sorting desyncs displayed rank from DB authority.
- Fatal missing-env handling breaks optional infrastructure.
- New writes without policy review can widen public capabilities.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
