# Shadow / Lighting System

## Purpose

Own frame-level sun model, shadow projection rules, ambient darkness overlay inputs, and heightmap shadow-mask generation consumed by presentation, debug, and structure-presentation code.

## Scope

- Sun/ambient model: `src/shadowSunV1.ts`
- Day-cycle math/runtime: `src/shadowSunDayCycle.ts`, `src/game/systems/presentation/shadowSunDayCycleRuntime.ts`
- Frame shadow context/routing: `structureShadowFrameContext.ts`, `structureShadowTypes.ts`, `structureShadowVersionRouting.ts`
- Entity shadow projection: `src/game/systems/presentation/renderShadow.ts`, `src/engine/render/auxiliary/auxiliaryCanvasRenderer.ts`
- Heightmap loading: `src/engine/render/sprites/heightmapLoader.ts`
- Heightmap buffer/ray march: `heightmapShadow/sceneHeightBuffer.ts`, `heightmapRayMarch.ts`
- Ambient darkness overlay: `renderLighting.ts`, `ui/renderScreenOverlays.ts`, `src/game/render/renderDebugPolicy.ts`
- Render integration: `src/game/systems/presentation/render.ts`

## Non-scope

- Structure geometry/slicing: `docs/canonical/structure_geometry_slicing_system.md`
- Atlas/cache and render ordering/backend submission: `docs/canonical/atlas_render_cache_system.md`, `docs/canonical/presentation_rendering_pipeline.md`
- Production of `w.lighting` outside final overlay consumption
- Parked `worldLightRenderPieces.ts` projected/static light registry; not wired into `render.ts`
- Parked `structureShadowV6*` raster/cache implementation; not part of live frame submission

## Entrypoints

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

## Pipeline

1. **Day Cycle**: `render.ts` resolves debug/render flags and calls `resolveShadowSunDayCycleRuntime(...)`. Runtime is `WeakMap<World, ...>`, reseeds on manual hour/cycle mode/steps-per-day changes, advances only in `world.state === "RUN"`, clamps to one quantized step span, and outputs continuous/effective hour, optional `shadowStepKeyOverride`, and debug status.
2. **Sun Context**: `buildStructureShadowFrameContext(...)` combines effective hour and azimuth/elevation overrides via `getShadowSunV1LightingState(...)`. `shadowSunV1.ts` outputs direction label, forward vector, projected shadow direction, cast enablement, deterministic `stepKey`, and `ambientSunLighting`. Quantized day cycle may override step key suffix. Routing metadata currently resolves `usesV6Sweep: true`.
3. **Entity Shadows**: world collection emits `worldPrimitive` with `shadowParams`; `Canvas2DRenderer.executeCommand()` calls `renderEntityShadow(...)`, which uses support surface height, hover delta, and sun projection to fade/compress/offset ellipses. Disabled casting or zero projection draws nothing.
4. **Heightmap Mask**: enabled only when `heightmapShadowsEnabled !== false` and sun casts shadows. `renderSprites.ts` loads manifest-enabled sibling heightmaps; live manifest enables `structures/buildings/batch1/`. Visible overlays contribute only with structure sprite id, loaded heightmap, and ready color sprite. `compositeSceneHeightBuffer(...)` builds downscaled max-height buffer using color-sprite alpha as occupancy and grayscale height `0..1`; `computeHeightmapShadowMask(...)` ray-marches to a `Float32Array`. Cache key includes map id, sun step key, viewport size, camera translation, resolution divisor, and ray parameters. `render.ts` enqueues mask as debug/world primitive; `Canvas2DRenderer` draws black alpha in world space.
5. **Ambient Overlay**: `renderScreenOverlays(...)` gates final darkness with `shouldApplyAmbientDarknessOverlay(...)` and enqueues a screen primitive with `w.lighting.darknessAlpha`, `ambientTint`, `ambientTintStrength`. `renderAmbientDarknessOverlay(...)` draws full-screen darkness/tint. Final overlay is driven by `w.lighting`, not `ambientSunLighting.ambientDarkness01`.
6. **Backend / Debug Handoff**: `render.ts` passes `shadowSunModel` and `ambientSunLighting` to world and overlay `Canvas2DRenderer`; screen debug/perf surfaces read the same state. Even with WebGL world pieces, shadow/ambient auxiliary commands remain Canvas2D-backed.

## Invariants

- Day-cycle runtime is per `World` via `WeakMap`, not process-global.
- Disabled day cycle has `shadowStepKeyOverride === undefined` and effective hour equal to manual seed.
- Automatic shadow time advances only in `RUN`.
- Each render pass has one shared `shadowSunModel` and `ambientSunLighting`.
- Quantized day-cycle steps produce deterministic cache keys.
- Entity shadows derive from support-surface height plus sun projection, not sprite bounds alone.
- Heightmap mask requires casting sun and enabled flag.
- Heightmap support is manifest opt-in; live rollout is `structures/buildings/batch1/`.
- Height buffer uses color-sprite alpha occupancy, grayscale height normalization, and max-blending.
- Heightmap mask cache reuses only on exact explicit-key match.
- Final darkness/tint overlay consumes `w.lighting.*`; `ambientSunLighting` is not final overlay authority.
- Shadow/ambient auxiliary rendering stays Canvas2D-backed with WebGL world rendering.
- Frame routing metadata currently always has `usesV6Sweep: true`.

## Constraints

- One authoritative sun model/step key per frame; consumers must not derive independent time.
- Shadow cache keys must include every visible-output input, especially map id, quantized sun step, viewport/camera, ray params.
- Day-cycle advancement remains world-scoped and paused outside active run state.
- Heightmap generation only admits overlays with ready color sprite and loaded heightmap.
- Heightmap silhouettes continue using rendered color sprite alpha unless asset contract changes.
- If final ambient darkness moves from `w.lighting` to sun-derived data, update this doc with the new authority.

## Dependencies

### Incoming

- Debug/render settings from `src/settings/debugToolsSettings.ts`, `src/settings/systemOverrides.ts`, `src/userSettings.ts`
- World inputs: `world.state`, `w.lighting.darknessAlpha`, `w.lighting.ambientTint`, `w.lighting.ambientTintStrength`
- Compiled-map support-surface queries and visible overlays
- Loaded heightmaps and ready structure sprite images
- Frame viewport/camera from render pipeline

### Outgoing

- `shadowSunModel` / `ambientSunLighting` to render/debug consumers
- Entity-shadow world primitives through auxiliary Canvas2D
- Heightmap mask primitives
- Final screen-space ambient darkness/tint commands
- Day-cycle debug status for overlays/perf surfaces

## Extension

- Sun direction/elevation in `getShadowSunV1Model(...)`
- Day-cycle modes, step counts, speed multipliers
- Frame-level consumers through `buildStructureShadowFrameContext(...)`
- Heightmap resolution/ray tuning via settings
- Parked projected-light or structure-shadow raster/cache paths only after wiring into `render.ts` and updating this doc

## Failure Modes

- Assuming `ambientSunLighting.ambientDarkness01` drives final darkness is wrong today.
- Missing sun/viewport inputs in heightmap cache keys leaves stale masks.
- Advancing day cycle outside `RUN` desyncs non-combat states.
- Treating parked `worldLightRenderPieces.ts` or `structureShadowV6*` as live frame submission misreads architecture.
- Omitting color-sprite alpha mask shadows transparent regions.
- Assuming all structures contribute to heightmap shadows ignores manifest/loading gates.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
