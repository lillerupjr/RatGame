# Renderer Decomposition Contract — RatGame

## Phase 4.5: Debug Overlay and Tools Extraction

### Goal
Move debug overlays, debug drawing helpers, and debug-frame flag/tool resolution out of `src/game/systems/render.ts` into a dedicated debug subsystem without changing non-debug rendering behavior or existing debug semantics.

---

## Required File Structure

src/game/systems/presentation/debug/
- debugRenderTypes.ts
- debugRenderFlags.ts
- debugFrameContext.ts
- renderDebugPass.ts
- renderDebugStructures.ts
- renderDebugLighting.ts
- renderDebugWorld.ts
- renderDebugEntities.ts

---

## Scope

Includes:
- debug overlay drawing
- debug pass orchestration
- debug flag resolution
- debug frame data packaging

Excludes:
- UI changes
- behavior changes
- rendering algorithm changes

---

## Goal State

`render.ts` contains only:

```
if (frame.debug.enabled) {
  executeDebugPass(ctx, frame, debugFrame);
}
```

---

## Rules

- Do NOT change behavior
- Do NOT mix debug into production rendering
- Do NOT create debugUtils/helper dump files
- Keep category ownership strict

---

## Acceptance Criteria

- render.ts no longer calls individual debug overlays
- debug flags resolved in one place
- debug pass centralized
- behavior unchanged

---

## Principle

Debug is a subsystem, not part of the core renderer.
