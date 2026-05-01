# WORLD Renderer Contract (Agent-Friendly, V1)

## Status

**Design locked enough to implement.**

This contract defines the renderer migration from the current
phase-split world pipeline to a new **GROUND → WORLD → SCREEN/UI**
model.

This is a **V1 renderer architecture contract**.\
It intentionally prefers a simple, coherent world-ordering system over
preserving older special-case paths.

Current implementation note:

- static eligible ground presentation is chunk-rasterized inside
  `GROUND`
- world atlas routing is resolved before `WORLD` submission
- ground chunk raster surfaces remain separate from the world atlas
  families

------------------------------------------------------------------------

# 1. Goal

Replace the current world render model:

-   ground
-   entities
-   lights
-   occluders
-   structure scratch composite

with a simpler model:

-   **GROUND**
-   **WORLD**
-   **SCREEN/UI**

The main invariant is:

**All world-space objects that can visually overlap or occlude each
other must compete in one shared WORLD ordering domain.**

This includes buildings, entities, props, lights, loot, projectiles, and
VFX.

------------------------------------------------------------------------

# 2. Problem Statement

The current renderer is:

-   slice-aware during collection
-   z-band aware during emission
-   but phase-split during final world draw

Current failure mode:

-   buildings/sliced structures are spatially assigned correctly
-   entities are spatially assigned correctly
-   lights are spatially assigned correctly
-   but final draw order is still broken because phase boundaries
    override local world ordering

This produces bugs such as:

-   building slices drawing over actors incorrectly
-   lights being occluded incorrectly because they are drawn in a
    separate phase
-   structure scratch acting as a second render authority

The new renderer must remove those failure modes.

------------------------------------------------------------------------

# 3. Locked Architectural Decisions

## 3.1 Renderer Passes

The renderer is now conceptually split into:

### GROUND

Ground-bound visuals only.

### WORLD

All world-space competing renderables.

### SCREEN/UI

Screen-space overlays, HUD, full-screen effects, debug text, etc.

------------------------------------------------------------------------

## 3.2 WORLD Is the Single World Competition Domain

WORLD is the only pass that determines visible front/back ordering
between world objects.

There is no separate world-space:

-   occluder phase
-   light phase as independent depth authority
-   structure scratch late composite
-   second world-depth system

------------------------------------------------------------------------

## 3.3 Separate "Occluder" Category Is Removed

Buildings, props, and structure slices are just **WORLD geometry**.

------------------------------------------------------------------------

## 3.4 Structure Scratch Is Removed

**Structure scratch has no place in the new renderer.**

There is no late structure composite path that can override WORLD
ordering after WORLD has already been drawn.

------------------------------------------------------------------------

## 3.5 Lights Are First-Class WORLD Objects

Lights join WORLD as ordinary world drawables.

**Light render pieces are ordinary WORLD drawables with additive
blend.**

Ordering comes from WORLD sorting.

------------------------------------------------------------------------

## 3.6 Light Occlusion

For V1, light occlusion is handled by WORLD ordering.

If geometry sorts in front of a light render piece, it visually occludes
that light.

------------------------------------------------------------------------

## 3.7 kindOrder

`kindOrder` is **tie-breaker only** and must never act as a hidden
render phase.

------------------------------------------------------------------------

# 4. WORLD Membership

## 4.1 GROUND

Contains only ground-attached visuals:

-   floor tiles
-   decals
-   lane markings
-   ground shadows

GROUND is not a competition domain for actors or structures.

------------------------------------------------------------------------

## 4.2 WORLD

WORLD contains:

-   player
-   enemies
-   NPCs
-   loot / pickups
-   projectiles
-   VFX
-   light render pieces
-   props
-   building slices
-   all current structures

Rule:

**If a world object can visually overlap actors or structures, it
belongs in WORLD.**

------------------------------------------------------------------------

## 4.3 SCREEN/UI

Contains:

-   HUD
-   menus
-   debug overlays
-   perf text
-   screen-space effects
-   ambient darkness overlay

These do not participate in world ordering.

------------------------------------------------------------------------

# 5. zBand Model

## 5.1 Keep zBand Loops

The renderer keeps **zBand loops** as the major vertical partition.

This preserves support for future multi-level maps.

------------------------------------------------------------------------

## 5.2 baseZ vs zBand

`baseZ` remains raw spatial data.

For V1:

-   `baseZ` derives `zBand`
-   `baseZ` is **not** part of the WORLD comparator

Vertical partitioning is handled only by **zBand loops**.

------------------------------------------------------------------------

# 6. WORLD Ordering Model (V1)

Inside each zBand, WORLD pieces are sorted using:

1.  `slice`
2.  `within`
3.  `feetSortY`
4.  `kindOrder`
5.  `stableId`

Overall order:

1.  `zBand`
2.  then inside each band:
    -   `slice`
    -   `within`
    -   `feetSortY`
    -   `kindOrder`
    -   `stableId`

------------------------------------------------------------------------

# 7. Field Meanings

### slice

Primary isometric diagonal key.

`slice = tx + ty`

------------------------------------------------------------------------

### within

Secondary tile ordering inside a slice.

`within = tx`

Meaning: **position along the diagonal**.

------------------------------------------------------------------------

### feetSortY

Optional refinement for actor-like objects.

Used mainly by: - entities - projectiles - actor-like VFX

------------------------------------------------------------------------

### kindOrder

Tie-breaker only.

Never a replacement for spatial ordering.

------------------------------------------------------------------------

### stableId

Final deterministic tie-breaker.

Prevents flickering or unstable sort results.

------------------------------------------------------------------------

# 8. Building / Structure Slices

The existing structure slicing system remains valid.

Structures already produce render pieces with world ownership metadata.

These slices must simply enter the WORLD ordering system normally.

No late composite paths.

------------------------------------------------------------------------

# 9. Lights

Light render pieces:

-   enter WORLD normally
-   use additive blend where appropriate
-   obey WORLD ordering

No special light render phase.

------------------------------------------------------------------------

# 10. Ground

GROUND pass responsibilities:

-   draw floor surfaces
-   draw decals
-   draw ground shadows

GROUND must not become a fallback for world objects.

------------------------------------------------------------------------

# 11. Implementation Constraints

Do not preserve old renderer behavior if it conflicts with the new
architecture.

Specifically remove:

-   occluder phase authority
-   structure scratch authority
-   independent light depth authority

Reuse existing spatial data where possible.

------------------------------------------------------------------------

# 12. Validation Requirements

Validate against real gameplay scenes.

Required checks:

### Player in front of building

Buildings no longer stamp over actors due to phase ordering.

### Light behind building

World geometry correctly occludes lights.

### Actor near prop

Props and actors sort spatially correctly.

### Tall building slices

Slices remain stable across diagonals.

### Projectiles / VFX near structures

These obey WORLD ordering.

------------------------------------------------------------------------

# 13. Comparator Validation

V1 comparator:

slice → within → feetSortY → kindOrder → stableId

If a concrete visual issue appears, comparator refinement is allowed.

Reintroducing removed render authorities is **not allowed**.

------------------------------------------------------------------------

# 14. Out of Scope

Not required for this contract:

-   physically accurate lighting
-   full shadow simulation
-   spatial metadata redesign
-   perfect pixel-level ordering

This is a **V1 coherent renderer architecture**.

------------------------------------------------------------------------

# 15. Done Definition

The contract is done when:

-   Renderer clearly follows **GROUND → WORLD → SCREEN/UI**
-   WORLD is the only world-space competition domain
-   Structure scratch is removed
-   Occluder phase is removed
-   Lights are WORLD objects
-   zBand loops remain
-   baseZ derives zBand but is not used in WORLD comparator
-   WORLD ordering uses the V1 comparator
-   Downtown-style scenes render correctly

------------------------------------------------------------------------

# 16. Short Design State

## LOCKED

-   GROUND / WORLD / SCREEN-UI renderer
-   All world objects join WORLD
-   Structure scratch removed
-   Occluder phase removed
-   Lights are WORLD drawables
-   zBand loops kept
-   baseZ derives zBand only
-   kindOrder is tie-breaker
-   V1 ordering:
    -   slice
    -   within
    -   feetSortY
    -   kindOrder
    -   stableId

## OPEN (validation only)

Comparator refinement if real scenes reveal issues.
