# AGENTS.md

## Purpose

This file is the top-level operational guide for implementation agents.

It defines:

- agent workflow in this repo
- source-of-truth and drift rules
- global repo and engine invariants
- contract and documentation maintenance rules
- a small set of editing rules
- Canonical docs include design constraints (non-negotiable system rules)

It does **not** contain deep system architecture. Canonical system docs in `/docs/canonical/` are the primary source of truth for system architecture and intended behavior.

## Agent Workflow

1. Start with the relevant canonical doc in `/docs/canonical/`.
2. Use `/docs/file_tree.md` to find the owned files and nearby integration points.
3. Inspect only the local code needed to implement or verify the change.
4. Do not rediscover full-system architecture from code during normal work.
5. If the change affects system behavior, boundaries, invariants, design constraints, or entrypoints, update the canonical doc in the same patch.
6. If working from a contract, use the contract for scope and intent, then bring canonical docs up to date before considering the work complete.

## Source of Truth and Drift

- Canonical docs are the primary source of truth for system architecture and intended behavior.
- Code inspection is for implementation and local verification, not for replacing canonical docs as the architectural reference.
- Contracts describe intended changes and implementation scope. After implementation, canonical docs remain authoritative.
- `AGENTS.md` is not a substitute for canonical system documents.

If local code conflicts with a canonical doc:

- treat the mismatch as drift
- stop and report it clearly
- do not silently trust code over docs
- do not silently work around the inconsistency

Drift resolution requires one of two outcomes:

- fix the code, or
- update the canonical doc because intent changed

Drift is blocking work, not a note to clean up later.

## Global Repo / Engine Invariants

### System Interaction and Ownership

- The repo uses a shared mutable world model with system-style updates.
- Systems should communicate through world state, shared helpers, and events, not through hidden cross-system coupling.
- Shared behavior must be centralized. Do not create parallel copies of coordinate logic, render ordering logic, collision rules, or other cross-system helpers.
- A shared field or structure should have a clear owner or a clearly centralized write path.

### Coordinate Spaces

- The engine uses four distinct spaces:
  - table space: authored map grid
  - tile space: logical compiled grid
  - world space: continuous gameplay coordinates
  - screen space: projected canvas coordinates
- Conversions between spaces must be explicit.
- Do not mix table or tile coordinates with screen-space math.
- World-to-screen projection must stay centralized.

### Axis and Dimension Identity

- Table space and tile space use the same axis orientation.
- `+x` is east/right.
- `+y` is south/down.
- Width extends along `+x`.
- Height extends along `+y`.
- Do not swap `x/y`, swap `w/h`, flip signs, or introduce hidden rotations.

### Direction Semantics

- Direction semantics are domain-specific and must not be conflated.
- Tile/map directions use tile-space axes:
  - `E` = `+x`
  - `W` = `-x`
  - `S` = `+y`
  - `N` = `-y`
- Stair-direction tokens describe uphill direction in map/tile space.
- Sprite/facing direction tokens may be derived from projected or screen-derived vectors and should be treated as presentation-facing labels, not as raw tile-axis truth.
- Table space has no standalone directional meaning beyond its identity mapping into tile-space axes.
- If a direction mapping changes, update all consumers in the same patch through the shared mapping/helper path.

### Z Role Semantics

- Vertical state is split by role.
- `zLogical` is gameplay-layer membership.
- `zVisual` is render-sorting depth.
- `zOcclusion` is visibility blocking.
- `zBase` / `zTop` describe physical height bands.
- Do not overload one Z field to mean another role. Add a new named field if a new vertical contract is needed.

### Surfaces and Blocking

- Floors are surfaces.
- Stairs and ramps are connectors between surfaces.
- Walls are occluders/blockers, not generic walkable surfaces.
- Movement, spawn placement, and similar walkability decisions must use shared surface/walkability queries rather than ad hoc geometry rules.

### High-Level Render Ordering

- The top-level render-pass order is:
  1. `GROUND`
  2. `WORLD`
  3. `SCREEN/UI`
- Chunk-rasterized ground belongs in `GROUND`.
- Competing world-space objects share the `WORLD` ordering domain.
- HUD, screen overlays, and other screen-space layers belong in `SCREEN/UI`.
- Detailed render-pipeline behavior belongs in the relevant canonical docs, not here.

## Contracts and Documentation

- Canonical docs must stay aligned with implementation.
- Any system-level change is incomplete until its canonical doc is updated in the same patch.
- Use `/docs/canonical/documentation_framework.md` as the rulebook for canonical doc structure and maintenance.
- Keep system-specific architecture out of `AGENTS.md`. Put it in the relevant canonical doc instead.

When working from a contract:

- use the contract for intended scope and implementation order
- keep any explicit progress checklist current
- do not treat the contract as current architectural truth after implementation
- When given a contract in raw text, persist it to /docs/contracts/implemented/ only if it defines a meaningful system-level change or reusable design; otherwise treat it as ephemeral.

## Editing Rules

- Prefer extending existing systems over creating duplicate ownership paths.
- Centralize new shared logic in helpers or existing ownership boundaries.
- Avoid one-off coordinate, direction, Z, render-order, or walkability conventions.
- If a change modifies a global invariant in this file, update all affected code and docs in the same patch.
- Keep this file concise and global. If a section starts reading like a system doc, move that detail to `/docs/canonical/`.
