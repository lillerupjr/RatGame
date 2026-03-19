# Renderer Decomposition Contract — RatGame

## Phase 1: Structure Triangle Extraction

### Goal
Split `render.ts` by ownership boundaries without changing visual behavior.

### Scope
Extract structure triangle subsystem into dedicated modules.

---

## Required File Structure

src/game/systems/presentation/structureTriangles/
- structureTriangleTypes.ts
- structureTriangleAlphaReadback.ts
- structureTriangleCulling.ts
- structureTriangleOwnership.ts
- structureTriangleGrouping.ts
- structureTriangleBuilder.ts
- structureTriangleDebug.ts
- structureTriangleCacheRebuild.ts

---

## Move from render.ts

### Types
- StructureSliceDebugRect
- StructureSliceDebugPoint
- StructureSliceDebugTriangleStats
- StructureSliceDebugAlphaMap
- RuntimeStructureTriangleBounds
- RuntimeStructureTrianglePiece
- RuntimeStructureTriangleParentTileGroup

### Ownership / math
- positiveMod
- resolveTriangleCentroidOwnerTile
- hashStructureTriangleStableId

### Alpha readback
- getStructureSliceDebugAlphaMap
- readback canvas/cache

### Culling
- pointInTriangle
- mapDebugPointFromDstToSrc
- triangleHasVisibleSpritePixels

### Builder
- buildRuntimeStructureTriangleDebugPieces

### Grouping
- groupRuntimeStructureTrianglePiecesByParentTile

### Debug
- drawStructureSliceTriangleDebugOverlay

### Cache + loading
- classifyRuntimeStructureTriangleAsset
- mapWideOverlayViewRect
- collectMapWideStructureOverlays
- buildRuntimeStructureProjectedDraw
- runtimeStructureTriangleGeometrySignatureForOverlay
- toRuntimeStructureTriangleRect
- buildRuntimeStructureTriangleCacheForOverlay
- rebuildRuntimeStructureTriangleCacheForMap
- prepareRuntimeStructureTrianglesForLoading

---

## Rules

- Do NOT change behavior
- Do NOT change visual output
- Pure modules must NOT draw
- Only debug module may draw
- Only alpha readback may touch canvas
- No “renderUtils.ts” dumping

---

## Acceptance Criteria

- render.ts reduced in size
- structure triangle logic removed from render.ts
- debug overlay unchanged
- triangle culling unchanged
- cache + loading behavior unchanged
- ordering unchanged

---

## Next Phases (not part of this task)

- Extract static relight subsystem
- Extract structure shadow orchestration
- Reduce render.ts to orchestrator

---

## Principle

From:
“one file that knows everything”

To:
“one orchestrator coordinating clear ownership modules”
