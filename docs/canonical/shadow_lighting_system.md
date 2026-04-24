# Shadow / Lighting System

## Purpose

- Own the frame-level sun model, shadow projection rules, ambient darkness compositing, and heightmap shadow-mask generation used by presentation.
- Provide a single shadow/lighting context that downstream render, debug, and structure-presentation code can consume without recomputing sun state independently.

## Scope

- Sun-model and ambient-sun state derivation in:
  - `src/shadowSunV1.ts`
- Day-cycle math and per-world runtime state in:
  - `src/shadowSunDayCycle.ts`
  - `src/game/systems/presentation/shadowSunDayCycleRuntime.ts`
- Frame-level shadow context build and routing metadata in:
  - `src/game/systems/presentation/structureShadows/structureShadowFrameContext.ts`
  - `src/game/systems/presentation/structureShadows/structureShadowTypes.ts`
  - `src/game/systems/presentation/structureShadows/structureShadowVersionRouting.ts`
- Entity shadow geometry and projection in:
  - `src/game/systems/presentation/renderShadow.ts`
  - `src/engine/render/auxiliary/auxiliaryCanvasRenderer.ts`
- Heightmap asset discovery and on-demand load in:
  - `src/engine/render/sprites/heightmapLoader.ts`
- Heightmap shadow-buffer composition and ray-march masking in:
  - `src/game/systems/presentation/heightmapShadow/sceneHeightBuffer.ts`
  - `src/game/systems/presentation/heightmapShadow/heightmapRayMarch.ts`
- Ambient darkness overlay composition in:
  - `src/game/systems/presentation/renderLighting.ts`
  - `src/game/systems/presentation/ui/renderScreenOverlays.ts`
  - `src/game/render/renderDebugPolicy.ts`
- Render-pipeline integration and backend handoff in:
  - `src/game/systems/presentation/render.ts`

## Non-scope

- Structure geometry generation, triangle ownership, and structure-slice derivation
- Atlas/cache ownership and render-command ordering
- Production of `w.lighting` state outside this system’s consumption of that state for final screen overlays
- The parked projected/static light registry in `src/game/systems/presentation/worldLightRenderPieces.ts`, which is not wired into `render.ts`
- The parked structure-shadow raster/cache implementation under `src/game/systems/presentation/structureShadows/structureShadowV6*`, which is not part of the live frame path

## Key Entrypoints

- `src/shadowSunV1.ts`
- `src/shadowSunDayCycle.ts`
- `src/game/systems/presentation/shadowSunDayCycleRuntime.ts`
- `src/game/systems/presentation/structureShadows/structureShadowFrameContext.ts`
- `src/game/systems/presentation/structureShadows/structureShadowVersionRouting.ts`
- `src/game/systems/presentation/renderShadow.ts`
- `src/game/systems/presentation/renderLighting.ts`
- `src/engine/render/sprites/heightmapLoader.ts`
- `src/game/systems/presentation/heightmapShadow/sceneHeightBuffer.ts`
- `src/game/systems/presentation/heightmapShadow/heightmapRayMarch.ts`
- `src/game/systems/presentation/ui/renderScreenOverlays.ts`
- `src/game/systems/presentation/render.ts`
- `src/engine/render/auxiliary/auxiliaryCanvasRenderer.ts`

## Data Flow / Pipeline

1. **Settings and Day-Cycle Runtime**
   - `render.ts` resolves the current debug/render flags and calls `resolveShadowSunDayCycleRuntime(...)`.
   - `shadowSunDayCycleRuntime.ts` keeps per-world day-cycle state in a `WeakMap<World, ...>`.
   - The runtime:
     - reseeds when the manual hour, cycle mode, or steps-per-day change
     - advances only while `world.state === "RUN"`
     - clamps per-frame advancement to at most one quantized step span
   - The result is:
     - `continuousTimeHour`
     - `effectiveTimeHour` / quantized shadow hour
     - optional `shadowStepKeyOverride`
     - debug status for overlays and perf surfaces

2. **Sun Model and Frame Shadow Context**
   - `buildStructureShadowFrameContext(...)` turns the effective hour plus azimuth/elevation overrides into frame-wide shadow state via `getShadowSunV1LightingState(...)`.
   - `shadowSunV1.ts` derives:
     - sun direction label
     - forward vector
     - projected shadow direction
     - shadow-casting enablement
     - deterministic `stepKey`
     - `ambientSunLighting`
   - When day-cycle quantization is active, `shadowStepKeyOverride` replaces the sun model’s step key suffix so downstream caches can align with quantized steps.
   - The same frame context currently resolves routing metadata with `usesV6Sweep: true`.

3. **Entity Shadow Projection**
   - World collection emits `worldPrimitive` commands carrying `shadowParams`.
   - `Canvas2DRenderer.executeCommand()` routes those payloads to `renderEntityShadow(...)`.
   - `renderEntityShadow(...)`:
     - queries the support surface at the entity’s world position
     - derives hover height from `worldZ - support.worldZ`
     - fades and compresses the ellipse as hover height increases
     - offsets the shadow along the sun projection direction
   - If the entity disables shadow casting, or the resolved projection vector is zero, no shadow is drawn.

4. **Heightmap Shadow-Mask Pass**
   - `render.ts` enables the pass only when:
     - `renderSettings.heightmapShadowsEnabled !== false`
     - `shadowSunModel.castsShadows === true`
   - `renderSprites.ts` triggers on-demand heightmap loading through `heightmapLoader.ts` for manifest-enabled sprite ids; the live manifest currently enables `structures/buildings/batch1/`.
   - It gathers visible overlays that have:
     - a structure sprite id
     - a loaded heightmap
     - a ready color sprite image
   - `compositeSceneHeightBuffer(...)` builds a screen-space max-height buffer at the configured downscaled resolution, using the sprite alpha channel as the authoritative occupancy mask and normalizing heightmap grayscale values into `0..1` scene-height values.
   - `computeHeightmapShadowMask(...)` ray-marches from each pixel toward the light source and writes a `Float32Array` shadow mask.
   - The mask is cached by an explicit key that includes:
     - map id
     - sun step key
     - viewport size
     - camera translation
     - resolution divisor
     - ray-march parameters
   - `render.ts` enqueues the resulting mask as a debug/world primitive, and `Canvas2DRenderer` draws it back into world space as a black alpha mask.

5. **Ambient Darkness Screen Overlay**
   - `renderScreenOverlays(...)` decides whether the final darkness overlay is allowed through `shouldApplyAmbientDarknessOverlay(...)`.
   - When enabled, it enqueues a `screenOverlay:primitive` payload carrying:
     - `w.lighting.darknessAlpha`
     - `w.lighting.ambientTint`
     - `w.lighting.ambientTintStrength`
   - `Canvas2DRenderer` delegates that payload to `renderAmbientDarknessOverlay(...)`, which applies a full-screen darkness fill and optional tint pass.
   - The final ambient darkness overlay is currently driven by `w.lighting`, not by `ambientSunLighting.ambientDarkness01`.

6. **Backend Handoff, Debug, and Auxiliary Rendering**
   - `render.ts` passes `shadowSunModel` and `ambientSunLighting` into both world and overlay `Canvas2DRenderer` instances.
   - Screen debug overlays and perf-debug surfaces consume the same frame state for readouts.
   - Even when the main world backend is WebGL, shadow/ambient auxiliary commands still execute through the Canvas2D auxiliary renderer.

## Core Invariants

- Shadow day-cycle runtime state is keyed per `World` instance via `WeakMap`, not global process state.
- When day-cycle mode is disabled, `shadowStepKeyOverride` is `undefined` and the effective shadow hour remains the manual seed hour.
- Automatic shadow time advancement occurs only while `world.state === "RUN"`.
- The live frame uses one shared `shadowSunModel` and one shared `ambientSunLighting` object for that render pass.
- A quantized day-cycle step produces a deterministic step key that downstream shadow consumers can cache against.
- `renderEntityShadow(...)` derives shadow placement from support-surface height plus sun projection, not from sprite bounds alone.
- Heightmap shadow masking only runs when the sun is casting shadows and the feature flag is enabled.
- Heightmap support is opt-in through the `heightmapLoader.ts` manifest; the live asset rollout currently enables `structures/buildings/batch1/` only.
- `compositeSceneHeightBuffer(...)` uses color-sprite alpha as the occupancy mask, normalizes heightmap grayscale values into `0..1`, and max-blends per-pixel height values.
- `computeHeightmapShadowMask(...)` reuses cached mask storage only when the explicit cache key matches the current frame inputs.
- The final full-screen darkness/tint overlay consumes `w.lighting.*` values; `ambientSunLighting` is not the authoritative final overlay input in the live path.
- Shadow/ambient auxiliary rendering stays Canvas2D-backed even when the ordered world pieces render through WebGL.
- The frame shadow routing metadata currently always resolves `usesV6Sweep: true`.

## Design Constraints

- The frame must have one authoritative sun model and one authoritative sun step key. Shadow consumers must not derive independent time-of-day state per subsystem.
- Shadow cache invalidation must remain explicit and include every input that changes visible output, especially map id, quantized sun step, viewport/camera, and ray-march parameters.
- Day-cycle advancement must remain world-scoped and paused outside active run state so menus, map nodes, and reward screens do not advance shadow time.
- Heightmap shadow generation must stay conservative: only overlays with both ready color sprites and loaded heightmaps may contribute to the scene height buffer.
- Heightmap silhouettes must continue to use the rendered color sprite alpha as occupancy authority unless the asset contract changes and this document is updated.
- Final ambient darkness behavior must remain explicit about its source of truth. If the system moves from `w.lighting`-driven overlay alpha to sun-derived ambient darkness, this document must be updated with the new authority.

## Dependencies (In/Out)

### Incoming

- Debug and render settings from:
  - `src/settings/debugToolsSettings.ts`
  - `src/settings/systemOverrides.ts`
  - `src/userSettings.ts`
- World state inputs:
  - `world.state`
  - `w.lighting.darknessAlpha`
  - `w.lighting.ambientTint`
  - `w.lighting.ambientTintStrength`
- Compiled-map support-surface queries and visible overlay data
- Loaded sprite heightmaps and ready structure sprite images
- Frame viewport and camera translation from the render pipeline

### Outgoing

- `shadowSunModel` and `ambientSunLighting` shared across render/debug consumers
- Entity-shadow world primitives executed by the auxiliary Canvas2D renderer
- Heightmap shadow-mask primitives enqueued into the frame
- Final screen-space ambient darkness/tint overlay commands
- Day-cycle debug status consumed by screen overlays and perf-debug surfaces

## Extension Points

- Sun direction/elevation mapping in `getShadowSunV1Model(...)`
- Day-cycle modes, step counts, and speed multipliers in `shadowSunDayCycle.ts`
- Additional frame-level shadow consumers through `buildStructureShadowFrameContext(...)`
- Heightmap shadow resolution and ray-march tuning through the debug/render settings inputs
- Future activation of the parked projected-light registry or structure-shadow raster/cache path, if they are wired into `render.ts` and this document is updated

## Failure Modes / Common Mistakes

- Assuming `ambientSunLighting.ambientDarkness01` drives the final screen darkness is incorrect in the live path; the overlay currently reads `w.lighting`.
- Forgetting to include sun-step or viewport inputs in a heightmap shadow cache key causes stale masks to survive camera or time-of-day changes.
- Advancing the day cycle outside `RUN` state would desynchronize shadow time across menus and non-combat states.
- Treating the parked `worldLightRenderPieces.ts` registry as a live render dependency causes misleading architecture assumptions; it is not wired into `render.ts`.
- Treating the parked `structureShadowV6*` modules as active frame submission logic is incorrect; the live path only resolves routing metadata for structure-shadow consumers.
- Building the height buffer without masking against the visible color sprite alpha would shadow transparent regions and produce incorrect silhouettes.
- Assuming every structure sprite participates in heightmap shadows is incorrect; only manifest-enabled asset families with loaded sibling heightmaps can contribute today.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
