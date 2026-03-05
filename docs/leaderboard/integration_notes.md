# End-Run Leaderboard Integration Notes

## UI hook points
- End-run overlay markup is in `index.html` under `#end`.
- End-run behavior is in `src/game/game.ts` (`showEndScreen`, `populateEndStats`, and death/run-end transitions).

## End-run data sources used for leaderboard payload
- `heat`: derived from `world.runHeat` via `getEndRunSummary(world)` in `src/game/game.ts`.
- `kills`: derived from `world.kills` in `src/game/game.ts`, clamped to a non-negative integer.
- `characterId`: derived from `world.currentCharacterId` in `src/game/game.ts` with fallback to `UNKNOWN`.

## Summary adapter location
- `src/game/game.ts` uses a single adapter function `getEndRunSummary(world)` that maps runtime world data to leaderboard payload fields (`heat`, `kills`, `characterId`).

## Stored leaderboard row fields
- `display_name`
- `heat`
- `kills`
- `character_id`

## Files involved in leaderboard feature
- `src/config/supabase.ts`
- `src/leaderboard/leaderboardClient.ts`
- `src/game/game.ts`
- `src/ui/styles/overlays.css`
- `index.html`
- `supabase/migrations/202603051200_init.sql`
- `docs/leaderboard/README.md`
- `docs/leaderboard/integration_notes.md`
