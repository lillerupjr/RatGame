# File Tree

## Top Level

| Path | Role |
|---|---|
| `/README.md` | Repo overview and dev commands |
| `/package.json` | npm scripts for dev, build, test, utilities |
| `/vite.config.ts` | Vite app/build config |
| `/vitest.config.ts` | Vitest config |
| `/index.html` | DOM shell for world canvas, UI canvas, HUD, menus |
| `/src` | Runtime source root |
| `/docs` | Canonical docs, contracts, design notes |
| `/public` | Runtime-served asset output; large generated trees omitted |
| `/supabase` | Leaderboard schema and migrations |
| `/tools` | One-off repo and palette utilities |

`/src`: `main.ts` bootstrap/app loop/UI wiring; `/engine` world/math/audio/render primitives; `/game` runtime/systems/content/maps/bosses/progression; `/settings` persistent user/debug/system settings; `/ui` DOM-facing shell/overlays; `/leaderboard` Supabase client.

## Major Systems

| Area | Key Paths |
|---|---|
| App / Runtime Bootstrapping | `/src/main.ts`; `/src/game/game.ts`; `/src/game/app/appState.ts`; `loadingFlow.ts`; `loadingScreen.ts`; `pauseController.ts` |
| World / Runtime Model | `/src/engine/world/world.ts`; `/src/game/events.ts`; `/src/game/content/registry.ts`; `/src/game/factories/enemyFactory.ts` |
| Presentation / Rendering | `/src/game/systems/presentation/render.ts`; `/collection/collectFrameDrawables.ts`; `/frame/renderFrameBuilder.ts`; `/backend`; `/contracts`; `/ui`; `/src/engine/render/` |
| Map Compilation / Activation | `/src/game/map/authoredMapActivation.ts`; `delveMap.ts`; `routeMapView.ts`; `/authored/authoredMapRegistry.ts`; `/compile/kenneyMap.ts`; `kenneyMapLoader.ts` |
| Simulation / Combat | `/src/game/systems/sim/input.ts`; `movement.ts`; `combat.ts`; `collisions.ts`; `projectiles.ts`; `/src/game/combat_mods/` |
| Hostile AI / Spawn | `/src/game/systems/enemies/brain.ts`; `behavior.ts`; `actions.ts`; `/src/game/systems/spawn/hostileSpawnDirector.ts`; `hostileSpawnExecution.ts`; `spawn.ts` |
| Progression / Objectives / Rewards | `/src/game/systems/progression/objective.ts`; `objectiveSpec.ts`; `rewardRunEventProducerSystem.ts`; `rewardSchedulerSystem.ts`; `rewardPresenterSystem.ts`; `/src/game/rewards/`; `/src/game/vendor/` |
| Boss System | `/src/game/bosses/bossSystem.ts`; `spawnBossEncounter.ts`; `bossRuntime.ts`; `bossRegistry.ts`; `bossDefinitions.ts`; `bossArena*.ts` |
| Settings / Debug | `/src/settings/settingsStore.ts`; `settingsTypes.ts`; `debugToolsSettings.ts`; `systemOverrides.ts`; `/src/ui/devTools/devToolsPanel.ts`; `/src/ui/settings/settingsPanel.ts` |
| UI Shell | `/index.html`; `/src/ui/domRefs.ts`; `menuWiring.ts`; `/pause`; `/rewards`; `/vendor`; `/dialog`; `/mobile` |

## Docs

| Path | Role |
|---|---|
| `/docs/AGENTS.md` | Repo architecture invariants for implementation work |
| `/docs/README.md` | Docs organization and maintenance guidance |
| `/docs/canonical/` | Current source-of-truth system docs |
| `/docs/contracts/implemented/` | Implemented contracts grouped by domain |
| `/docs/contracts/draft/` | Exploratory or not-yet-authoritative contracts |
| `/docs/design/` | Product and content design docs |

Canonical docs: `game_runtime_app_loop.md`, `world_state_runtime_data_model.md`, `presentation_rendering_pipeline.md`, `map_compilation_activation_floor_topology.md`, `atlas_render_cache_system.md`, `structure_geometry_slicing_system.md`, `shadow_lighting_system.md`, `core_simulation_combat_runtime.md`, `hostile_ai_spawn_runtime.md`, `progression_objectives_rewards.md`, `boss_encounter_system.md`, `combat_mods_stat_resolution_loadout_effects.md`, `settings_overrides_debug_controls.md`, `ui_shell_menus_runtime_panels.md`, `database.md`, `documentation_framework.md`.

Implemented contract domains: `rendering`, `spawning`, `boss`, `progression`, `settings`, `simulation`, `structures`, `gameplay`, `palette`.

## Notes

- Large asset trees under `src/assets/`, `public/assets-runtime/`, and build output under `dist/` are intentionally summarized.
- Canonical architecture docs live in `docs/canonical/`; `docs/systems/` references are stale.
