# STRUCTURE Layer + Runtime Sprite Slicing Contract

Version: 1.0\
Status: ACTIVE IMPLEMENTATION CONTRACT\
Audience: In-IDE Agent / Automated Refactor Agent / Render Pipeline
Maintainers

------------------------------------------------------------------------

# 1. PURPOSE

This contract introduces:

1.  A dedicated STRUCTURE render layer.
2.  Runtime sprite band slicing (removes need for pre-sliced building
    PNGs).
3.  Clear separation between STRUCTURE and OCCLUDER responsibilities.
4.  A migration path away from the "full sprite render" pipeline.

The goal is to remove manual sprite slicing while preserving
deterministic painter ordering.

This document is authoritative. If any rule conflicts with existing
behavior, this contract wins.

------------------------------------------------------------------------

# 2. DEFINITIONS

STRUCTURE\
Tall world-anchored art that must interleave with entities using
deterministic painter ordering. Examples: - Buildings - Containers -
Tall props

OCCLUDER\
Reserved for true occlusion primitives only. Currently: - Walls only
Future: - LOS blockers - Stencil masks - Vision blockers

Runtime Band Slicing\
Splitting a single sprite into multiple horizontal bands in code, each
rendered as its own RenderPiece.

------------------------------------------------------------------------

# 3. RENDER LAYER ORDER (MANDATORY)

The renderer MUST use the following order:

1.  UNDERLAY
2.  FLOOR
3.  ENTITY
4.  VFX
5.  STRUCTURE
6.  OCCLUDER
7.  OVERLAY

STRUCTURE MUST render after VFX and before OCCLUDER.

OCCLUDER MUST NOT be used for buildings or containers.

------------------------------------------------------------------------

# 4. RUNTIME SLICING SPECIFICATION

## 4.1 Band Type (Phase 1)

Horizontal band slicing ONLY.

-   Bands are cut along sprite Y.
-   Default band height: 64 pixels.
-   Bands are ordered from top (index 0) to bottom (index N-1).

No vertical slicing in Phase 1.

------------------------------------------------------------------------

## 4.2 Inputs

For each STRUCTURE instance:

-   spriteId (single sprite)
-   world tile position (tx, ty)
-   baseZ (height stacking)
-   anchor configuration
-   bandPx (default = 64)
-   sliceStride (default = 1)

------------------------------------------------------------------------

## 4.3 Outputs

The system MUST emit N RenderPieces, one per band.

Each band MUST contain:

-   srcRect: selects band region from sprite
-   dst position: derived from anchor + band offset
-   RenderKey configured as defined below

------------------------------------------------------------------------

# 5. RENDER KEY MAPPING (MANDATORY)

Given:

baseSlice = tx + ty

For band index i:

slice = baseSlice + (i \* sliceStride) within = tx kindOrder = STRUCTURE
stableId = hash(structureInstanceId, i)

This ensures bands interleave with existing tile slice ordering.

No screen-space primary sort is allowed in Phase 1. Bands must integrate
into existing slice bucket logic.

------------------------------------------------------------------------

# 6. PERFORMANCE REQUIREMENTS

-   Band slicing metadata MUST be cached per sprite.
-   No per-frame image scanning.
-   No per-frame band allocation if avoidable.
-   drawImage with srcRect is acceptable.

------------------------------------------------------------------------

# 7. DEBUG REQUIREMENT

A debug toggle MUST exist that:

-   Draws band boundaries
-   Displays band index numbers
-   Does NOT alter render ordering

This is mandatory before migration is considered complete.

------------------------------------------------------------------------

# 8. ASSET CONTRACT

During migration, a STRUCTURE may be:

A)  Legacy sliced (multiple sprite files)\
B)  Runtime sliced (single sprite + bandPx)

The choice MUST be data-driven via structure definitions.

Renderer MUST NOT hardcode behavior based on sprite file naming.

------------------------------------------------------------------------

# 9. MIGRATION PLAN (STRICT ORDER)

Step 1\
Add STRUCTURE to KindOrder.

Step 2\
Route buildings and containers to STRUCTURE layer.

Step 3\
Implement horizontal runtime slicing helper.

Step 4\
Feature-flag runtime slicing on one building.

Step 5\
Validate: - Entity interleaving works - No regressions in tile
rendering - Debug overlay confirms correct band order

Step 6\
Migrate remaining buildings.

Step 7\
Delete pre-sliced PNG exports.

Step 8\
Remove full sprite render pipeline (glob-based direct asset scanning).

------------------------------------------------------------------------

# 10. REMOVAL CONTRACT (FULL SPRITE PIPELINE)

Renderer MUST NOT:

-   Depend on glob scanning for runtime behavior
-   Render arbitrary PNG paths directly

Renderer MUST depend on: - Resolved sprite IDs from map skins - Building
skin definitions - Prop definitions

After migration: The full sprite render pipeline must be deletable
without breaking runtime.

------------------------------------------------------------------------

# 11. NON-GOALS

This contract does NOT:

-   Implement true occlusion
-   Change global painter model
-   Introduce screen-space global sorting
-   Solve per-pixel silhouette sorting

------------------------------------------------------------------------

# 12. ACCEPTANCE CHECKLIST

\[x\] STRUCTURE exists in KindOrder\
\[ \] STRUCTURE layer order is correct\
\[ \] Buildings render with STRUCTURE\
\[ \] OCCLUDER used only for walls\
\[ \] One building renders correctly using single sprite + runtime
slicing\
\[ \] Debug overlay works\
\[ \] Legacy sliced assets still function during transition\
\[ \] Full sprite pipeline removable

------------------------------------------------------------------------

END OF CONTRACT
