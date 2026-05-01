# Implemented Contract Audit / Extraction Pass

## Goal

- Use implemented contracts as a verification and extraction pass, not as current truth.
- Ensure no important invariant lives only inside an implemented contract.
- Reduce implemented contracts so they remain historical implementation records after extraction.

## Truth Order

1. Canonical docs define current intended system truth.
2. Code shows current implementation reality.
3. Implemented contracts are historical design and rollout records.

During this pass, the question is:

> Does this contract still describe something that is both intended and implemented?

## Workflow

For each implemented contract:

1. Check whether it still describes a real existing system.
2. Compare it against the current canonical doc and the local code needed for that comparison.
3. Classify it.
4. Extract any still-important invariants:
   - system-specific invariants -> relevant canonical doc
   - broader cross-cutting design principles -> `/docs/design/` when needed
5. Reduce the contract so it remains historical and no longer carries unique architectural truth.

## Classification Rules

- `Still valid reference`
- `Partially stale`
- `Fully obsolete`

Also track whether the contract still contains important design invariants that must be extracted.

## Success Rule

- No important invariant should live only inside an implemented contract.

## Audit Groups

### Group 1 - Settings + UI Tooling

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/settings/settings_architecture_v1.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/settings_overrides_debug_controls.md`
  - `docs/contracts/implemented/palette/palette_snapshot_palette_lab.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/settings_overrides_debug_controls.md`
      - `docs/canonical/ui_shell_menus_runtime_panels.md`
- Notes:
  - No separate `/docs/design/` extraction was needed for this group.
  - The settings contract is stale around migration/reset assumptions and predates the current compatibility facade.
  - The palette snapshot contract is stale where it describes snapshot viewing as a paused simulation mode; current code uses a runtime viewer flag inside the normal run shell.

### Group 2 - Rendering Core + Atlas

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/rendering/world_renderer_contract.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/presentation_rendering_pipeline.md`
  - `docs/contracts/implemented/rendering/iso_quad_rendering.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/presentation_rendering_pipeline.md`
  - `docs/contracts/implemented/rendering/pure_quad_rect_render.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/presentation_rendering_pipeline.md`
      - `docs/canonical/atlas_render_cache_system.md`
  - `docs/contracts/implemented/rendering/dynamic_and_static_atlas.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/atlas_render_cache_system.md`
- Primary canonical targets:
  - `docs/canonical/presentation_rendering_pipeline.md`
  - `docs/canonical/atlas_render_cache_system.md`
- Notes:
  - No separate `/docs/design/` extraction was needed for this group.
  - The renderer contracts still describe the live pass split and prepared-piece model, but they are stale as migration docs and overstate some triangle/light claims.
  - The atlas contract is stale around experimental-language and old cross-links, but its mode-routing and fallback invariants still mattered.

### Group 3 - Structure Geometry + Slice Ownership

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/structures/runtime_slice_ownership.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/structure_geometry_slicing_system.md`
  - `docs/contracts/implemented/structures/monolithic/computed_monolithic_building_basis_v2.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/structure_geometry_slicing_system.md`
      - `docs/canonical/map_compilation_activation_floor_topology.md`
  - `docs/contracts/implemented/structures/monolithic/monolithic_footprint_inference_v1.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/structure_geometry_slicing_system.md`
  - `docs/contracts/implemented/structures/monolithic/v1_footprint_inference_lowest_stable_support.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/structure_geometry_slicing_system.md`
- Primary canonical targets:
  - `docs/canonical/structure_geometry_slicing_system.md`
  - `docs/canonical/map_compilation_activation_floor_topology.md`
- Notes:
  - No separate `/docs/design/` extraction was needed for this group.
  - The live structure system still uses monolithic semantic basis and parent-tile ownership, but the exact ownership helper and footprint algorithm differ from the old contracts.
  - The monolithic-basis contracts are stale where they assume sprite-derived geometry fully replaces fallback data; current code still supports semantic placement fallbacks.

### Group 4 - Shadow + Palette Model

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/rendering/heightmap_shadow_casting_plan.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/shadow_lighting_system.md`
  - `docs/contracts/implemented/palette/hue_locked_palette_remap_v1.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/presentation_rendering_pipeline.md`
      - `docs/canonical/settings_overrides_debug_controls.md`
  - `docs/contracts/implemented/palette/palette_darkness_debug_controls.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/presentation_rendering_pipeline.md`
      - `docs/canonical/settings_overrides_debug_controls.md`
      - `docs/canonical/shadow_lighting_system.md`
- Primary canonical targets:
  - `docs/canonical/shadow_lighting_system.md`
  - `docs/canonical/presentation_rendering_pipeline.md`
  - `docs/canonical/settings_overrides_debug_controls.md`
- Notes:
  - No separate `/docs/design/` extraction was needed for this group.
  - The heightmap shadow plan still matches the live height-buffer plus ray-march architecture, but it overstates universal asset support and includes future GPU/soft-shadow ideas that are not live system truth.
  - The hue-lock contract is stale where it assumes palette-id-only caching and unconditional original `S` / `V` preservation; the live path keys variants by palette plus weights and now blends saturation plus applies darkness.
  - The palette-darkness contract is stale where it treats palette darkness as the repo’s night-mood authority; the live full-screen darkness overlay is driven by `w.lighting`, while palette darkness is a sprite-remap brightness control.

### Group 5 - Hostile Runtime + Spawn Architecture

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/gameplay/enemy_system_refactor_design_contract.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/hostile_ai_spawn_runtime.md`
      - `docs/canonical/core_simulation_combat_runtime.md`
  - `docs/contracts/implemented/spawning/spawn_director_v1.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/hostile_ai_spawn_runtime.md`
  - `docs/contracts/implemented/spawning/spawn_director_v1_contract.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/hostile_ai_spawn_runtime.md`
  - `docs/contracts/implemented/spawning/hostile_spawn_director_v1_FULL_contract.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/hostile_ai_spawn_runtime.md`
  - `docs/contracts/implemented/spawning/spawn_director_v1_tuning.md`
    - Classification: `Partially stale`
    - Important design invariants: `Yes`
    - Extracted to:
      - `docs/canonical/hostile_ai_spawn_runtime.md`
- Primary canonical targets:
  - `docs/canonical/hostile_ai_spawn_runtime.md`
  - `docs/canonical/core_simulation_combat_runtime.md`
- Notes:
  - No separate `/docs/design/` extraction was needed for this group.
  - The enemy-refactor contract still matches the live split between static enemy metadata, runtime brain state, movement consumption, and modular hostile abilities, but its proposed type shapes and some state names differ from the implemented system.
  - The spawn-director contracts still match the live budget/threat/role-first/request-output architecture, but they are stale as rollout specs and underdescribe the current floor-heat scaling, debug snapshot shape, and exact selection helpers.
  - The tuning contract still matches the live `t0` / `t120` / overtime anchor model, but the current implementation also multiplies those anchors by depth-driven heat settings.

### Group 6 - Progression + Runtime Flow

- Status: `Pending`
- Contracts:
  - `docs/contracts/implemented/progression/delve_node_single_visit.md`
  - `docs/contracts/implemented/progression/objective_exit_unification.md`
  - `docs/contracts/implemented/simulation/time_scale_and_wasted.md`
- Primary canonical targets:
  - `docs/canonical/progression_objectives_rewards.md`
  - `docs/canonical/game_runtime_app_loop.md`
  - `docs/canonical/core_simulation_combat_runtime.md`

### Group 7 - Boss Design

- Status: `Pending`
- Contracts:
  - `docs/contracts/implemented/boss/ratgame_boss_design.md`
- Primary canonical targets:
  - `docs/canonical/boss_encounter_system.md`
- Possible design target:
  - `/docs/design/`

### Group 8 - Documentation / Meta

- Status: `Completed`
- Contracts:
  - `docs/contracts/implemented/documentation/canonical_documents_implementation.md`
    - Classification: `Fully obsolete`
    - Important design invariants: `No`
- Notes:
  - No extraction was needed in this group. The still-live process rules already live in:
    - `docs/canonical/documentation_framework.md`
    - `docs/AGENTS.md`
  - This contract now serves only as rollout history for the initial 14-system canonical-doc pass.
  - Its original execution checklist is complete, and its remaining instructions are no longer the active maintenance model.
