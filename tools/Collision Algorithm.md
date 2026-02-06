You can copy-paste this directly into a file like:

docs/projectile-solid-face-collision.md

# Projectile ↔ Solid Face Collision Contract

> **Instruction to LLM**
>
> * No time-gated comments
> * Contract-style documentation only
> * This document is linear and complete
> * Each section represents a locked architectural step
> * Achievements record completed invariants

---

## 1. Purpose (Locked)

Define a **minimal, deterministic collision rule** where projectiles are destroyed when intersecting **solid vertical faces** defined on the tile grid.

This contract introduces:
- Grid-only projectile collision
- No pixel or sprite-based logic
- Shared geometry source for rendering and gameplay

---

## 2. World Model (Locked)

### 2.1 Tile Grid

The world is represented in a discrete tile grid:



(x, y)


Each projectile exists on a **logical height layer**:



zLogical


All collision queries are expressed strictly in:



(x, y, zLogical, dir)


---

### 2.2 Solid Face Definition

A **solid face** is a vertical blocking plane on a tile edge.



solidFace(x, y, zLogical, dir) : boolean


Where:
- `(x, y)` is the tile coordinate
- `zLogical` is the logical height layer
- `dir ∈ { N, E, S, W }`

A solid face blocks traversal **across that edge** at the given height.

---

## 3. Solid Face Symmetry (Locked)

Solid faces MUST be symmetric by construction.

The following invariants MUST hold:



solidFace(x, y, z, E) === solidFace(x + 1, y, z, W)
solidFace(x, y, z, S) === solidFace(x, y + 1, z, N)


Projectile logic MUST NOT attempt to repair or infer symmetry.

---

## 4. Projectile Collision Rule (Locked)

A projectile **dies immediately** when it crosses a solid face.

No other collision outcomes are defined in this contract.

---

## 5. Edge Crossing Detection (Locked)

Each projectile update step provides:

- Previous world position:


(px0, py0, zLogical)

- Next world position:


(px1, py1, zLogical)


These positions are converted to tile coordinates:



(tx0, ty0)
(tx1, ty1)


---

## 6. Collision Algorithm (Locked)

For each projectile update:

1. Convert previous and next positions to tile coordinates.
2. If `(tx0, ty0) == (tx1, ty1)`:
   - No collision check is required.
3. Otherwise:
   - Determine the crossed edge direction `dir`.
   - Query:
     ```
     solidFace(tx0, ty0, zLogical, dir)
     ```
4. If the query returns `true`:
   - Mark the projectile as dead.
   - Abort further processing for this projectile.

---

## 7. Movement Constraint (Locked)

This contract assumes **one of the following is true**:

- Projectiles move at most one tile per update step  
  OR
- Projectile movement is subdivided into multiple update steps

This document introduces no additional traversal logic.

---

## 8. Explicit Non-Goals (Locked)

This contract does NOT define:

- Pixel or shape intersection
- Diagonal face collision
- Partial blocking
- Reflection or ricochet behavior
- Entity or actor collision
- Sprite, apron, or curtain ownership logic

---

## 9. Achievements (Completed Invariants)

- Projectile collision is grid-only and deterministic
- Collision queries depend solely on `(x, y, zLogical, dir)`
- Rendering artifacts do not influence gameplay collision
- Solid faces act as the single source of truth for vertical blocking
- Projectile death behavior is stable across render and logic systems

---