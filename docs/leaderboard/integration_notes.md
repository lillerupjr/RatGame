# End-Run Leaderboard Integration Notes

## UI hook points
- End-run overlay markup is in `index.html` under `#end`.
- End-run behavior is in `src/game/game.ts` (`showEndScreen`, `populateEndStats`, and death/run-end transitions).

## End-run data sources used for leaderboard payload
- `depthReached`: derived from `getEndStatsDepth(world)` in `src/game/game.ts`.
- `kills`: derived from `world.kills` in `src/game/game.ts`, clamped to a non-negative integer.

## Summary adapter location
- `src/game/game.ts` uses a single adapter function `getEndRunSummary(world)` that maps runtime world data to leaderboard payload fields (`depthReached`, `kills`).

## Files involved in leaderboard feature
- `src/config/supabase.ts`
- `src/leaderboard/leaderboardClient.ts`
- `src/game/game.ts`
- `src/ui/styles/overlays.css`
- `index.html`
- `docs/leaderboard/supabase.sql`
- `docs/leaderboard/README.md`
- `docs/leaderboard/integration_notes.md`
