# Database

## Purpose

- Define the authoritative database boundary for the repo.
- Own Supabase-backed leaderboard persistence, preview query semantics, runtime payload mapping, and migration/deploy flow.

## Scope

- Supabase environment discovery in `src/config/supabase.ts` and `src/vite-env.d.ts`
- Leaderboard schema, ranking index, preview RPC, and row-level security in `supabase/migrations/202603051200_init.sql`
- Live migration application in `.github/workflows/pages-live.yml`
- Client normalization, preview, and insert behavior in `src/leaderboard/leaderboardClient.ts`
- Runtime world-to-leaderboard payload mapping and database availability fallback in `src/game/game.ts`

## Non-scope

- End-screen layout, tab wiring, and visual styling outside the database payload boundary
- Run-heat calculation internals beyond the exported leaderboard summary fields
- Non-leaderboard persistence systems
- Supabase project creation or manual console setup outside repo-managed files and workflows

## Key Entrypoints

- `src/config/supabase.ts`
- `src/vite-env.d.ts`
- `src/leaderboard/leaderboardClient.ts`
- `src/game/game.ts`
- `supabase/migrations/202603051200_init.sql`
- `.github/workflows/pages-live.yml`

## Data Flow / Pipeline

1. **Environment Discovery**
   - `getSupabaseEnv()` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - If either value is missing, it returns `null` and the runtime does not construct a database client.

2. **Runtime Summary Mapping**
   - `getEndRunSummary(world)` maps live world state to the database payload:
     - `heat` from `getRunHeat(world)`
     - `kills` from `world.kills`
     - `characterId` from `world.currentCharacterId` through leaderboard normalization
   - This summary is the only game-runtime payload handed to the database layer.

3. **Client Construction and Availability Gating**
   - `game.ts` constructs `LeaderboardClient` only when Supabase env is present.
   - When env is missing, end-run leaderboard UI remains non-fatal:
     - preview falls back to a local `YOU` row
     - submission is disabled
     - status text explains which env vars are missing

4. **Preview Path**
   - `loadEndLeaderboardPreview()` calls `LeaderboardClient.previewRun()`.
   - `LeaderboardClient.previewRun()`:
     - clamps `heat`, `kills`, `topLimit`, and `window`
     - calls the `leaderboard_preview` RPC
     - normalizes each returned row
     - injects a client-only `YOU` row into the around-you slice for display
   - Ranking authority stays server-side; the client only formats returned data.

5. **Submission Path**
   - `submitEndLeaderboardName()` sanitizes the typed display name and calls `LeaderboardClient.submitName()`.
   - `submitName()` inserts one row into `public.leaderboard_entries` with:
     - `season_id`
     - `heat`
     - `kills`
     - `display_name`
     - `character_id`
   - After a successful insert, the runtime reloads preview data instead of locally guessing final rank placement.

6. **Schema and Ranking Rules**
   - `202603051200_init.sql` defines the append-only `public.leaderboard_entries` table.
   - Stable ordering is:
     - `heat desc`
     - `kills desc`
     - `created_at asc`
     - `id asc`
   - `leaderboard_preview(...)` returns:
     - computed rank
     - top slice
     - around-you slice

7. **Migration / Deploy Path**
   - Schema changes live under `supabase/migrations/`.
   - `.github/workflows/pages-live.yml` resolves Supabase env, links the target project, and runs `supabase db push` on pushes to the `live` branch.

## Core Invariants

- The only repo-owned database surface today is the Supabase leaderboard path.
- Database availability is optional for runtime play; missing Supabase env must not block game startup or end-run flow.
- Browser writes are append-only inserts into `public.leaderboard_entries`; client update/delete access is not part of the system.
- The runtime-to-database payload is limited to `heat`, `kills`, and normalized `characterId`.
- `LeaderboardClient` defaults to season id `alpha`, and the migration policy also constrains public inserts to `season_id = 'alpha'`.
- Display names are sanitized to `A-Z`, `a-z`, digits, space, underscore, and hyphen, with a max length of 12.
- Character ids are uppercased and must match the leaderboard character-id pattern or fall back to `UNKNOWN`.
- Ranking order is determined by the database function and index order, not by client-side sorting heuristics.
- Database schema changes are tracked in `supabase/migrations/`, not in duplicated SQL copies under `docs/`.

## Design Constraints

- The canonical database boundary remains narrow: Supabase schema, migration, and leaderboard client behavior are authoritative; ad hoc SQL copies in docs are not allowed.
- Runtime code must degrade cleanly when database env is absent. Leaderboard persistence is optional infrastructure, not a boot requirement.
- Ranking semantics must remain server-owned and deterministic. UI code may format results, but it must not invent alternate ranking rules.
- Validation may be mirrored in the client for UX, but database constraints and RLS policies are the final enforcement layer.
- Public browser access must remain limited to preview reads and append-only inserts for the leaderboard feature.

## Dependencies (In/Out)

### Incoming

- `World` run summary data from `src/game/game.ts`
- Supabase env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- GitHub Actions secrets and vars used by `.github/workflows/pages-live.yml`
- Supabase CLI migration execution against the linked project

### Outgoing

- Preview payloads consumed by the end-run leaderboard UI
- Inserted leaderboard rows stored in `public.leaderboard_entries`
- Schema and policy changes applied through `supabase db push`

## Extension Points

- Add leaderboard fields by updating the migration set, RPC output, client types, runtime summary adapter, and UI consumption together
- Add new seasons by threading explicit season configuration through runtime, client, and policy boundaries
- Add additional database-backed features through their own tables/functions/contracts rather than overloading the leaderboard table
- Extend live deploy migration behavior through `.github/workflows/pages-live.yml`

## Failure Modes / Common Mistakes

- Changing leaderboard payload fields in runtime code without a matching migration/RPC update causes insert or preview drift.
- Duplicating migration SQL under `docs/` creates stale parallel truth and should not be repeated.
- Relaxing client sanitization without matching database policy changes produces avoidable submit failures.
- Re-sorting leaderboard rows in the client can desynchronize displayed rank semantics from the authoritative database result.
- Treating missing Supabase env as a fatal error breaks the intended optional-infrastructure behavior.
- Adding new write operations without corresponding policy review can accidentally widen public database capabilities.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
