# Renderer Decomposition Contract — RatGame

## Phase 2: Static Relight Extraction

### Goal
Extract the static relight system from render.ts into its own subsystem without changing behavior.

---

## Required File Structure

src/game/systems/presentation/staticRelight/
- staticRelightTypes.ts
- staticRelightBlendPlanner.ts
- staticRelightBakeDependencies.ts
- staticRelightBakeComposer.ts
- staticRelightBakeRebuild.ts

---

## Move from render.ts

### Types
- StaticRelightFrameContext
- StaticRelightRuntimeState
- StaticGroundRelightBakeResult
- StaticRelightBakeDependencyTracker

### Planning
- clamp01
- planStaticRelightBlendForPiece
- hasNearbyStaticRelightTileLight

### Dependency tracking
- createStaticRelightBakeDependencyTracker
- noteStaticRelightDependencyState
- classifyStaticRelightBakeAsset

### Bake composition
- drawPieceLocalRelightMask
- composePieceLocalRelightBakedCanvas
- scratch canvas management (relight only)

### Runtime state + rebuild
- resolveStaticRelightRuntimeState
- rebuildFullMapStaticGroundRelightBake
- prepareStaticGroundRelightForLoading

---

## Rules

- Do NOT change relight visual output
- Do NOT change fallback behavior
- Do NOT change retry/pending logic
- Scratch canvases must ONLY live inside relight composer
- Planning must be pure (no canvas access)
- Dependency tracking must be pure

---

## Acceptance Criteria

- render.ts no longer contains static relight logic
- relight bake output identical
- pending/retry logs unchanged
- fallback behavior unchanged
- performance characteristics unchanged

---

## Principle

Static relight is a full subsystem, not a helper.

It must be isolated to prevent:
- cache bugs
- palette drift issues
- agent confusion

---

## Next Phase

Phase 3: Structure Shadow Orchestration
