# File Tree

## Top Level

/README.md — repo overview and core dev commands
/package.json — npm scripts for dev, build, test, and utilities
/vite.config.ts — Vite app/build configuration
/vitest.config.ts — Vitest configuration
/index.html — DOM shell for the world canvas, UI canvas, HUD, and menus

/src — runtime source root
  main.ts — top-level bootstrap, app loop, and UI wiring
  /engine — shared engine primitives for world state, math, audio, and rendering
  /game — game runtime, systems, content, maps, bosses, and progression
  /settings — persistent user/debug/system settings
  /ui — DOM-facing UI shell and overlays
  /leaderboard — Supabase leaderboard client

/docs — canonical docs, contracts, and design notes
/public — runtime-served asset output; large generated trees intentionally omitted
/supabase — leaderboard schema and migration files
/tools — one-off repo and palette utilities

## Major System Areas

### App / Runtime Bootstrapping
/src
  main.ts — app bootstrap and requestAnimationFrame loop
  /game
    game.ts — runtime orchestration surface used by `main.ts`
    /app
      appState.ts — app/run state controller
      loadingFlow.ts — staged loading pipeline and load profiler
      loadingScreen.ts — boot/loading screen renderer
      pauseController.ts — app-level pause gating

### World / Runtime Model
/src
  /engine
    /world
      world.ts — canonical mutable world state and shared runtime helpers
  /game
    events.ts — shared gameplay event types and payloads
    /content
      registry.ts — content lookup boundary for enemies, floors, relics, and items
    /factories
      enemyFactory.ts — enemy runtime slot creation

### Presentation / Rendering
/src/game/systems/presentation/
  render.ts — top-level frame rendering entrypoint
  /collection
    collectFrameDrawables.ts — gathers ground, effects, entities, and structures
  /frame
    renderFrameBuilder.ts — accumulates and finalizes render commands
  /backend — backend selection, execution planning, and WebGL surface routing
  /contracts — render-frame and render-command interfaces
  /ui — screen overlays and final UI pass
/src/engine/render/ — low-level render consumers, sprites, palettes, batching, and debug helpers

### Map Compilation / Activation
/src/game/map/
  authoredMapActivation.ts — activates compiled maps and exposes active-map queries
  delveMap.ts — run node graph and floor progression model
  routeMapView.ts — delve map overlay view model
  /authored
    authoredMapRegistry.ts — authored map catalog
  /compile
    kenneyMap.ts — compiled map runtime queries and tile/surface access
    kenneyMapLoader.ts — map loading and compile-time data assembly

### Simulation / Combat
/src/game/systems/sim/
  input.ts — input ingestion into world state
  movement.ts — player and entity movement updates
  combat.ts — core combat resolution entrypoint
  collisions.ts — hit and collision resolution
  projectiles.ts — projectile update loop
/src/game/combat_mods/ — combat stats, ailments, weapons, and relic reward plumbing

### Hostile AI / Spawn
/src/game/systems/enemies/
  brain.ts — per-enemy AI runtime state
  behavior.ts — high-level enemy behavior transitions
  actions.ts — enemy action and ability execution
/src/game/systems/spawn/
  hostileSpawnDirector.ts — pacing, heat scaling, and spawn budget logic
  hostileSpawnExecution.ts — turns spawn requests into runtime enemies
  spawn.ts — low-level enemy placement helpers

### Progression / Objectives / Rewards
/src/game/systems/progression/
  objective.ts — runtime objective state and resolution
  objectiveSpec.ts — objective authoring contract
  rewardRunEventProducerSystem.ts — emits reward-driving run events
  rewardSchedulerSystem.ts — converts run events into reward tickets
  rewardPresenterSystem.ts — opens reward UI from pending tickets
/src/game/rewards/ — reward budgets, run events, and ticket contracts
/src/game/vendor/ — vendor offer generation, pricing, and purchase flow

### Boss System
/src/game/bosses/
  bossSystem.ts — active encounter update loop
  spawnBossEncounter.ts — floor-specific boss encounter spawning
  bossRuntime.ts — encounter runtime state and lookup helpers
  bossRegistry.ts — boss and ability lookup boundary
  bossDefinitions.ts — authored boss content
  bossArena*.ts — arena tiles, patterns, and tile-effect support

### Settings / Debug Infrastructure
/src/settings/
  settingsStore.ts — persisted settings store
  settingsTypes.ts — settings schema and shared types
  debugToolsSettings.ts — debug-only settings bucket
  systemOverrides.ts — live tuning overrides
/src/ui/
  /devTools
    devToolsPanel.ts — developer settings and override panel
  /settings
    settingsPanel.ts — in-game settings UI

### UI Shell
/index.html — canvas and overlay DOM shell
/src/ui/
  domRefs.ts — typed DOM lookup boundary
  menuWiring.ts — main menu, character select, and palette lab wiring
  /pause — pause menu UI
  /rewards — relic reward menu UI
  /vendor — vendor shop UI
  /dialog — dialog choice rendering
  /mobile — touch controls

## Docs Structure

/docs
  AGENTS.md — repo architecture invariants for implementation work
  README.md — docs organization rules and maintenance guidance
  /canonical — current source-of-truth system docs
    game_runtime_app_loop.md — bootstrap, loading, and app loop
    world_state_runtime_data_model.md — canonical world/runtime model
    presentation_rendering_pipeline.md — render pipeline and backend routing
    map_compilation_activation_floor_topology.md — map compile and floor activation flow
    atlas_render_cache_system.md — atlas stores and render-cache ownership
    structure_geometry_slicing_system.md — structure slice generation and drawable prep
    shadow_lighting_system.md — sun state, shadow masks, and ambient darkness flow
    core_simulation_combat_runtime.md — per-frame sim, combat, projectiles, and DOT flow
    hostile_ai_spawn_runtime.md — hostile brain state, pacing, spawn requests, and action execution
    progression_objectives_rewards.md — objective runtime, reward queues, countdowns, and floor advancement
    boss_encounter_system.md — boss registration, cast runtime, arena hazards, and defeat cleanup
    combat_mods_stat_resolution_loadout_effects.md — starter loadouts, stat resolution, ailments, and relic-backed combat effects
    settings_overrides_debug_controls.md — persisted settings buckets, compatibility facade, and dev/runtime override flow
    ui_shell_menus_runtime_panels.md — DOM shell, menus, pause/runtime overlays, and touch interaction controllers
    database.md — Supabase leaderboard persistence and migration boundary
    documentation_framework.md — canonical doc maintenance rules
  /contracts
    /implemented — implemented contracts grouped by domain
      /rendering — atlas, quad, and renderer contracts
      /spawning — hostile spawn director contracts and tuning docs
      /boss — boss design contract
      /progression — delve and objective contracts
      /settings — settings architecture contract
      /simulation — time-scale and wasted-state contract
      /structures — runtime slice ownership and footprint contracts
      /gameplay — gameplay feature contracts
      /palette — palette and palette-lab contracts
    /draft — exploratory or not-yet-authoritative contracts
  /design — product and content design docs

## Optional Notes

- Large asset trees under `src/assets/`, `public/assets-runtime/`, and build output under `dist/` are intentionally summarized here.
- Canonical architecture docs live in `docs/canonical/`; older references to `docs/systems/` are stale.
