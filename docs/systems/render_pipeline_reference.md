# Canonical Render Pipeline Reference

Audience note:
This document explains the current live rendering pipeline used by RatGame.
It is a navigation and debugging reference for implementation agents.
It must describe the renderer as it exists now, not as a target architecture.

---

## 0. Purpose

This document is the canonical walkthrough for:

- where a frame starts
- how canonical render commands are emitted
- how the frame is finalized and reordered
- how Canvas2D and WebGL consume the frame
- which surfaces own world, screen, and UI presentation
- where current mixed-backend limitations still exist

Use this file before changing renderer flow, backend routing, command ownership, or presentation layering.

---

## 1. Primary entry points

Primary files:

- `src/main.ts`
- `src/game/systems/presentation/render.ts`
- `src/game/systems/presentation/contracts/renderCommands.ts`
- `src/game/systems/presentation/collection/collectFrameDrawables.ts`
- `src/game/systems/presentation/frame/renderFrameBuilder.ts`
- `src/game/systems/presentation/backend/renderExecutionPlan.ts`
- `src/game/systems/presentation/backend/renderBackendCapabilities.ts`
- `src/game/systems/presentation/backend/renderBackendRouting.ts`
- `src/game/systems/presentation/backend/Canvas2DRenderer.ts`
- `src/game/systems/presentation/backend/WebGLRenderer.ts`
- `src/game/systems/presentation/backend/webglSurface.ts`
- `src/game/systems/presentation/ui/renderScreenOverlays.ts`
- `src/game/systems/presentation/ui/renderUiPass.ts`

Supporting contract history:

- `docs/contracts/active/rendering/canonical_render_phase1.md`
- `docs/contracts/active/rendering/canonical_render_phase2.md`

---

## 2. Surface model

The runtime uses three presentation surfaces:

- `#c`
  Main Canvas2D world surface
- `#c-webgl`
  Attached WebGL world surface
- `#ui`
  Overlay canvas for screen overlays and UI

Current ownership:

- Canvas2D world rendering uses `#c`
- WebGL world rendering uses `#c-webgl`
- Screen overlays use `#ui`
- UI/HUD uses `#ui`

Visibility switching is handled by `syncWorldCanvasBackendVisibility(...)` in `src/game/systems/presentation/backend/webglSurface.ts`.

Important current rule:

- In WebGL mode the main world canvas is still present, but the visible world surface is `#c-webgl`

---

## 3. Shared frame pipeline

The shared frame pipeline starts in `renderSystem(...)` in `src/game/systems/presentation/render.ts`.

Current ordered stages:

1. Resolve camera/bootstrap/viewport and build `RenderFrameContext`
2. Build `CollectionContext`
3. Run `collectFrameDrawables(...)`
4. Add screen/debug commands from render assembly
5. Finalize builder output with `finalizeRenderFrame(...)`
6. Build ordered execution lists with `buildRenderExecutionPlan(...)`
7. Select backend
8. Execute world presentation
9. Execute screen overlays
10. Execute UI pass

Important shared invariant:

- collectors emit canonical commands
- frame building assigns `pass`, `key`, and `stage`
- execution-plan building preserves command objects and only reorders them

---

## 4. Command contract

The live top-level command contract is in `src/game/systems/presentation/contracts/renderCommands.ts`.

Every command carries:

- `semanticFamily`
- `finalForm`
- `pass`
- `key`
- `payload`

Current canonical semantic families:

- `groundSurface`
- `groundDecal`
- `worldSprite`
- `worldGeometry`
- `worldPrimitive`
- `screenOverlay`
- `debug`

Current canonical final forms:

- `quad`
- `projectedSurface`
- `triangles`
- `primitive`

Current strict-form families:

- `groundSurface / projectedSurface`
- `groundDecal / projectedSurface`
- `worldGeometry / triangles`

Current still-payload-routed families:

- `worldSprite / quad`
- `worldPrimitive / primitive`
- `screenOverlay / primitive`
- `debug / primitive`

---

## 5. Collector stage

Collector orchestration lives in `src/game/systems/presentation/collection/collectFrameDrawables.ts`.

Current collector order:

1. `collectGroundDrawables(...)`
2. `collectEffectDrawables(...)`
3. `collectEntityDrawables(...)`
4. `collectStructureDrawables(...)`

Collector responsibilities:

- emit canonical render commands
- assign semantic family and final form
- normalize payloads before enqueue where the family contract requires it
- compute render keys and stable ids

Notable current ownership:

- ground tops and ground decals are emitted by `collectGroundDrawables.ts`
- entities, projectiles, and player beam emission live in `collectEntityDrawables.ts`
- structures, roofs, props, and geometry emission live in `collectStructureDrawables.ts`

---

## 6. Frame builder and finalization

`src/game/systems/presentation/frame/renderFrameBuilder.ts` owns staging into:

- slice commands
- world-band commands
- world-tail commands
- screen commands

Current enqueue rules:

- `enqueueSliceCommand(...)` derives `GROUND` vs `WORLD` from `KindOrder`
- `enqueueWorldBandCommand(...)` always stages to `WORLD`
- `enqueueWorldTailCommand(...)` always stages to `WORLD`
- `enqueueScreenCommand(...)` always stages to `SCREEN`

`finalizeRenderFrame(...)` does:

- per-slice ordering
- feet-sort derivation for world objects
- z-band collection
- split into `ground`, `world`, `screen`

Important non-rule:

- `finalizeRenderFrame(...)` does not mutate `semanticFamily` or `finalForm`

---

## 7. Execution-plan building

`src/game/systems/presentation/backend/renderExecutionPlan.ts` turns `RenderFrame` into:

- `executionPlan.world`
- `executionPlan.screen`

Current ordering behavior:

- ground commands are inserted first within each z-band
- world-band commands are inserted next
- world slice commands are inserted after that
- world-tail commands are appended last
- screen commands remain separate

This means:

- `executionPlan.world` is the full ordered world stream
- `executionPlan.screen` is a separate ordered screen stream

---

## 8. Backend selection and routing

Backend selection happens in `render.ts` via `resolveRenderBackendSelection(...)`.

Current backend policy files:

- `src/game/systems/presentation/backend/renderBackendSelection.ts`
- `src/game/systems/presentation/backend/renderBackendCapabilities.ts`
- `src/game/systems/presentation/backend/renderCapabilityMatrix.ts`
- `src/game/systems/presentation/backend/renderFinalBackendMatrix.ts`

Current WebGL world execution path:

- `render.ts` calls `buildPureWebGLCommandList(executionPlan.world, stats)`
- only commands classified as WebGL-compatible survive that filter
- surviving commands are rendered by `WebGLRenderer`

Current Canvas2D world execution path:

- `Canvas2DRenderer.render(executionPlan)` renders the full world and screen command streams

Important current limitation:

- the selected WebGL path uses a pure-WebGL world list, not a generic mixed world segment executor
- therefore any world command classified as Canvas-only must be explicitly handled if it still needs to appear during WebGL mode

This is the main reason backend debugging must inspect both:

- canonical command emission
- backend classification in `classifyCommandBackend(...)`

---

## 9. Canvas2D pipeline

`src/game/systems/presentation/backend/Canvas2DRenderer.ts` owns the Canvas2D path.

Current render flow:

1. `clearMainCanvas()`
2. `clearOverlayCanvas()`
3. `drawBackground()`
4. `renderWorldCommands(plan.world)`
5. `renderScreenCommands(plan.screen)`

Current world rendering behavior:

- world commands render on the main canvas under `viewport.applyWorld(...)`
- `groundSurface` and `groundDecal` use the triangle-mesh path
- `worldGeometry` uses the triangle-mesh path
- `worldSprite` still supports both canonical image quads and several legacy payload descriptors
- `worldPrimitive` remains payload-routed by meaning

Current screen behavior:

- `screenOverlay` renders on the overlay canvas
- UI pass runs later on the same overlay canvas

---

## 10. WebGL pipeline

`src/game/systems/presentation/backend/WebGLRenderer.ts` owns the WebGL draw implementation.

Current render flow from `render.ts`:

1. clear overlay canvas
2. clear main Canvas2D world canvas
3. `webglRenderer.beginFrame()`
4. `webglRenderer.useWorldSpace()`
5. `webglRenderer.renderCommands(webglWorldCommands)`
6. `canvasRenderer.renderScreenCommands(executionPlan.screen)`

Current WebGL capabilities:

- `groundSurface / projectedSurface` via triangle draws
- `groundDecal / projectedSurface` via triangle draws
- `worldGeometry / triangles` via triangle draws
- canonical `worldSprite / quad`
- `screenOverlay / quad`
- ambient-darkness style `screenOverlay / primitive`
- selected `worldPrimitive / primitive` payloads such as projected lights and zone effects

Current WebGL limitation:

- `worldPrimitive / primitive` is not uniformly implemented
- unsupported or Canvas-routed world primitives do not automatically render in WebGL mode

---

## 11. Current known mixed points

These are the main places where agents must expect mixed behavior:

- `worldSprite / quad` still accepts legacy descriptor payloads in Canvas2D
- `worldPrimitive / primitive` is payload-routed, not uniformly form-routed
- WebGL selected mode still uses pure-WebGL world routing
- screen overlays and UI share the overlay canvas

Practical debugging consequence:

- if something is emitted correctly but only disappears in WebGL mode, check `classifyCommandBackend(...)` first
- if something disappears in both backends, inspect collector payload validity before backend code

---

## 12. Current debugging workflow

When debugging a render bug, inspect in this order:

1. Emitter path
2. Canonical pair assignment
3. Final-form payload validity
4. Frame builder / execution-plan ordering
5. Backend classification
6. Backend consumption
7. Surface ownership and later overlays

Key questions:

- Was the command emitted?
- Does it have the expected `semanticFamily + finalForm`?
- Is its payload already drawable?
- Which backend classified it as supported?
- Which visible surface actually owns the draw?

---

## 13. Maintenance rule

This document must be updated in the same patch as any change to:

- render entry sequencing
- command contract shape
- collector ownership
- frame builder/finalizer behavior
- backend selection or routing
- WebGL vs Canvas2D surface ownership
- screen-overlay or UI-canvas ownership
- known mixed-backend limitations
