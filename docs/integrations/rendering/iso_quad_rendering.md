# Quad-Native Renderer Contract
## Triangle-Free Rendering, Triangle-Allowed CPU

---

## Summary

Triangles are **allowed only on the CPU side** for:

- structure semantics
- metadata computation
- ownership and grouping
- cutout computation

Triangles are **not allowed in the renderers**.

All live rendering (Canvas2D + WebGL) must be:

> **quad-only**

---

## Core Architectural Rule

### CPU (allowed)
- triangles (semantic model only)
- structure decomposition
- cutout computation
- shadow/height metadata
- grouping / ownership

### Renderer (forbidden)
- triangle render payloads
- triangle submission
- triangle clipping paths

### Renderer (allowed)
- iso quads
- upright quads

---

## Pipeline

### CPU Stage

- build triangle-based semantic model
- compute:
    - ownership
    - sort keys
    - visibility / cutout
- aggregate triangles into **iso quad cells**

---

### Render Extraction Output

Canonical output:


QuadRenderPiece


Each piece contains:

- texture / atlas reference
- UV rect
- quad corners (4 points)
- sort key
- owner / group id
- optional metadata (future masks)

---

### Renderer Stage

- consumes QuadRenderPiece only
- batches quads
- submits quads

---

## Ground Contract

### Current
- projectedSurface = 2 triangles

### New
- ground = iso quad
- no triangle payloads

---

## Structure Contract

### Current
- triangle groups drive rendering

### New
- triangles used only for CPU semantics
- rendering uses **iso quad cells**

### Rules

- quad defined by canonical cell (cameraX, cameraY)
- no requirement for full triangle pairing
- partial alpha quads are valid

---

## Cutout Contract

### Current
- triangle-based selection

### New
- triangle computation (CPU)
- quad-cell selection (render)

---

## Renderer Contract

Must remove:

- RenderTriangle payloads
- drawTexturedTriangle usage
- triangle mesh submission
- projectedSurface triangle payloads

Must support:

- quad submission only

---

## Key Principle

> A quad is valid even if most of it is transparent.

Do NOT require:
- full occupancy
- triangle pairing

---

## Success Criteria

- no triangle render paths exist
- all world rendering is quad-based
- ground, structures, sprites unified
- cutout works via quad selection
- CPU triangle semantics remain intact

---

## Final Lock

> CPU may use triangles  
> Renderer may not