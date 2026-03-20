# Renderer Decomposition Contract — RatGame

## Stage 4: Typed Contexts & Bootstrap Cleanup

### Goal
Replace loose orchestration bags and giant parameter threading with typed stage contexts, and move remaining frame/bootstrap helpers out of `src/game/systems/render.ts`.

This pass is about **stabilizing stage contracts** and removing the last “utility warehouse” responsibilities from `render.ts`.

---

## Problem Statement

After Stage 3, the renderer has a real staged shape:

- `prepareRenderFrame`
- `collectFrameDrawables`
- `executeWorldPasses`
- `renderScreenOverlays`
- `renderUiPass`

However, `render.ts` still has two major problems:

1. **Loose stage contracts**
   - `Record<string, any>` world-pass context
   - very large argument lists to stage functions
   - too much manual threading of values

2. **Bootstrap / utility residue**
   - camera smoothing/bootstrap logic
   - void background loading/draw
   - viewport/culling helpers
   - tile/diamond intersection helpers
   - local presentation helpers still owned by `render.ts`

This means the pipeline exists, but the boundaries are not yet stable.

---

## Scope

This pass includes:
- introducing typed stage contexts
- eliminating `Record<string, any>` stage bags
- reducing giant parameter threading
- moving remaining bootstrap/background/culling helpers out of `render.ts`

This pass does **not** include:
- algorithm redesign
- pass-order changes
- ordering changes
- shadow/relight semantic changes
- debug semantic changes
- new rendering features

This is a contract and ownership pass, not a rendering redesign.

---

## Required File Structure

Create or extend:

src/game/systems/presentation/contracts/
- renderFrameContext.ts
- collectionContext.ts
- worldPassContext.ts
- screenOverlayContext.ts
- uiPassContext.ts

Create or extend:

src/game/systems/presentation/frame/
- prepareRenderFrame.ts
- backgroundPass.ts
- cameraBootstrap.ts
- viewportCulling.ts

Exact filenames may vary slightly if nearby modules already exist, but ownership must match this contract.

---

## Goal State

After this pass:

- `render.ts` uses typed context objects
- `collectFrameDrawables(...)` no longer has a giant ad hoc parameter list
- `executeWorldPasses(...)` no longer accepts `Record<string, any>`
- frame/bootstrap/culling/background helpers are no longer defined in `render.ts`
- `render.ts` becomes mostly pipeline wiring

Conceptually:

```ts
const frame = prepareRenderFrame(...);
const collection = buildCollectionContext(frame, ...);
const worldPass = buildWorldPassContext(frame, collection, ...);
const screenPass = buildScreenOverlayContext(frame, ...);
const uiPass = buildUiPassContext(frame, ...);

collectFrameDrawables(collection);
executeWorldPasses(worldPass);
renderScreenOverlays(screenPass);
renderUiPass(uiPass);
```

---

## Required Ownership Split

### 1. `renderFrameContext.ts`
Own the primary frame contract.

This should contain the stable typed frame object that stage functions depend on.

Examples:
- canvas/css/device sizes
- viewport
- camera-projected center
- player world/tile positions
- map references
- debug snapshot
- render settings snapshot
- tile size constants
- common frame-derived values

Rules:
- types only
- no drawing
- no algorithm logic

---

### 2. `collectionContext.ts`
Own the typed context for drawable collection.

This should bundle exactly what collection stages need, instead of threading dozens of individual values.

Examples:
- frame context
- map/visibility/culling references
- relight/shadow frame info
- draw registration callbacks
- structure collection dependencies
- entity presentation helpers

Rules:
- typed contract only
- no direct drawing
- no `any`
- no `Record<string, any>`

---

### 3. `worldPassContext.ts`
Own the typed contract for world-pass execution.

This replaces the current untyped world pass bag.

Examples:
- slice drawables
- z-band structures
- shadow-band structures
- pass-order inputs
- diagnostics objects
- perf draw-tag hooks

Rules:
- typed contract only
- no drawing implementation here
- no untyped bag pattern

---

### 4. `screenOverlayContext.ts`
Own the typed contract for screen-space overlays.

Examples:
- floor visual overlay inputs
- ambient darkness overlay inputs
- debug screen-pass inputs
- post-world overlay inputs

---

### 5. `uiPassContext.ts`
Own the typed contract for UI pass rendering.

Examples:
- overlay canvas/ui context
- nav arrow data
- UI dimensions/safe offsets
- DPS meter / HUD toggles
- death FX / screen overlay hooks if still needed

---

## Bootstrap Cleanup Requirements

Move the following out of `render.ts` into frame/bootstrap ownership modules:

### A. Camera / frame bootstrap
- `smoothTowardByHalfLife`
- camera smoothing / follow logic
- snapshot camera override logic
- viewport center-on-camera setup

This belongs in `cameraBootstrap.ts` and/or `prepareRenderFrame.ts`.

### B. Background ownership
- `getHardcodedVoidTop`
- `drawVoidBackgroundOnce`
- void background image/pattern state

This belongs in `backgroundPass.ts`.

### C. Culling / viewport helper ownership
- `pointInRect`
- `cross`
- `pointInConvexQuad`
- `onSegment`
- `segmentsIntersect`
- `tileDiamondIntersectsScreenRect`
- culling cache helpers
- `getCullingView`

This belongs in `viewportCulling.ts`.

### D. Player south wedge helper
- `isTileInPlayerSouthWedge`

This may live in a small view/debug/culling helper module if still used.

---

## Locked Rules

### Rule A — No untyped orchestration bags
`Record<string, any>` is forbidden for stage boundaries.

Replace with named typed contracts.

### Rule B — No giant parameter threading
If a stage call needs many values, create or extend a typed context object.
Do not keep expanding argument lists.

### Rule C — `render.ts` is not a frame utility warehouse
Bootstrap helpers, background ownership, and culling math must not remain in `render.ts`.

### Rule D — Keep pass order centralized
This pass does not move final pass-order authority away from `render.ts`.

### Rule E — No semantic changes
Do not change what the renderer draws or when it draws it.
Only improve contract and ownership structure.

---

## Required Migration Targets from `render.ts`

Move out or replace:

- background state/loading/draw helpers
- camera smoothing/bootstrap helpers
- culling geometry helpers
- untyped world-pass bag
- giant collection-stage parameter threading
- other remaining stage-local utility ownership that does not belong to the conductor

Keep in `render.ts` only:
- top-level stage order
- stage context creation
- stage invocation
- final high-level orchestration

---

## Acceptance Criteria

### Structural acceptance
- no `Record<string, any>` stage bag remains
- collection/world/screen/ui stages have typed context contracts
- background helpers are not declared in `render.ts`
- camera/bootstrap helpers are not declared in `render.ts`
- culling geometry helpers are not declared in `render.ts`

### Behavioral acceptance
- no visual changes
- no pass-order changes
- no ordering changes
- no shadow/relight/debug semantic changes

### Code quality acceptance
- `render.ts` reads as a conductor
- stage contracts are obvious and typed
- argument threading is materially reduced
- future stage work has clear extension points

---

## Anti-Drift Rules

Do not:
- keep temporary `any` bags “for now”
- move code without giving it a typed owner
- redesign algorithms while moving helpers
- split contracts across random helper files

Do:
- create stable typed contexts
- keep ownership explicit
- reduce parameter threading
- preserve behavior exactly

---

## Deliverable

Return:
1. changed files
2. new typed context files added
3. confirmation that untyped stage bags were removed
4. confirmation that `render.ts` no longer owns background/camera/culling helpers

---

## Principle

From:
“the pipeline exists, but stage boundaries are loose”

To:
“the renderer has typed, stable stage contracts and a clean conductor”
