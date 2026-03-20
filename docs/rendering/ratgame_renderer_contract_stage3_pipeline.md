# Renderer Decomposition Contract — RatGame

## Final Pass — Stage 3: Pipeline Staging & Orchestrator Split

### Goal
Break `renderSystem()` into clear high-level pipeline stages and move stage-specific logic into dedicated modules, making the renderer a readable conductor.

This pass follows subsystem extraction and focuses on **pipeline clarity**, not algorithm movement.

---

## Problem Statement

`renderSystem()` still:
- collects all drawables inline
- manages slice buckets
- executes z-band passes inline
- mixes world, debug, and UI rendering
- handles camera + background bootstrap

This makes the renderer hard to reason about despite subsystem extraction.

---

## Target Architecture

`render.ts` should become:

```
renderSystem(world, ctx) {
  const frame = prepareRenderFrame(world)

  const drawables = collectFrameDrawables(frame)

  const ordered = sortFrameDrawables(drawables)

  executeWorldPasses(ctx, frame, ordered)

  executeScreenOverlays(ctx, frame)

  executeUiPass(ctx, frame)

  if (frame.debug.enabled) {
    executeDebugPass(ctx, frame)
  }
}
```

---

## Required Extraction Targets

### 1. Frame Bootstrap

Create:
src/game/systems/presentation/frame/
- prepareRenderFrame.ts

Move:
- camera smoothing
- viewport calculation
- void background prep
- frame flags / settings snapshot

---

### 2. Drawable Collection

Create:
src/game/systems/presentation/collection/
- collectFrameDrawables.ts
- collectGroundDrawables.ts
- collectEntityDrawables.ts
- collectStructureDrawables.ts
- collectEffectDrawables.ts

Move:
- all “collect X into slices” logic
- slice bucket population
- drawable creation orchestration

---

### 3. Z-Band Execution

Create:
src/game/systems/presentation/passes/
- executeWorldPasses.ts

Move:
- z-band sorting
- ground/world pass execution
- shadow band compositing
- lighting pass coordination

---

### 4. Screen / UI Overlays

Create:
src/game/systems/presentation/ui/
- renderScreenOverlays.ts
- renderUiPass.ts

Move:
- floating text
- DPS meter
- death effects
- screen-space overlays

---

## Locked Rules

### Rule A — renderSystem becomes a pipeline
No inline large loops for collection or rendering.

### Rule B — No algorithm changes
Only move orchestration.

### Rule C — No duplication
Each stage owns its logic fully.

### Rule D — Keep pass order in one place
Pass order must remain readable and centralized.

---

## Acceptance Criteria

- renderSystem is <300 lines
- no large inline collection loops
- no z-band execution inline
- no UI rendering inline
- clear stage calls

---

## Deliverable

Return:
1. changed files
2. list of extracted stages
3. confirmation no behavior change

---

## Principle

From:
“renderSystem does everything”

To:
“renderSystem orchestrates clearly defined stages”
