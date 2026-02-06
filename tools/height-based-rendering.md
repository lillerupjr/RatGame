# Renderer Transition Plan: Height-Based Passes

## Purpose

Define a strict, height-based rendering contract and a safe migration plan from the current renderer to the new model. This document is written for use by an LLM inside an IDE.

## Hard Rules (Read First)

* Do NOT write time-gated comments (for example: "later we will", "temporary", "TODO for later").
* Do NOT rely on heuristics or special cases to fix ordering.
* All rendering behavior must be derivable from explicit data and strict ordering.
* Document all non-obvious logic directly in code using contract-style comments.
* Height ordering is authoritative. Nothing at a lower height may draw after a higher height.

## Terminology (Locked)

* APRONS: Background tile and stair sprites. These are not walkable faces and do not occlude.
* TOPS: Walkable surface faces.
* ENTS: Dynamic entities (player, enemies, projectiles, pickups, effects).
* OCCLUDERS: Walls only. These are the only true occluders.

The term "curtains" is deprecated and must not be used going forward.

## Target Render Contract

Rendering is performed in discrete height layers L, processed in ascending order.

For each height layer L:

1. APRONS(L)

   * Background floor and stair parts
   * Never occlude anything

2. TOPS(L)

   * Walkable surface faces

3. ENTS(L)

   * Player, enemies, projectiles, pickups, effects

4. OCCLUDERS(L)

   * Walls only
   * Occlude entities and lower geometry

After finishing layer L, proceed to layer L + 1.

This guarantees:

* Higher floors always visually cover lower floors and entities.
* Projectiles and entities can never appear above higher floors.
* Occlusion behavior is deterministic and height-based.

## Current State Summary

The current renderer mixes multiple concepts under a single "curtain" system:

* Floor aprons
* Stair aprons
* Walls

These are generated, bucketed, and rendered together. This causes:

* Incorrect occlusion behavior
* Ordering bugs (for example, projectiles visible above higher floors)
* Implicit heuristics (layer unions, draw queues)

The goal of this migration is to split these concepts cleanly.

## Required Data Model (Target)

Compiled map data must explicitly separate geometry by role and height.

Required structures:

* apronsByLayer: Map<height, Apron[]>
* topsByLayer: Map<height, Surface[]>
* occludersByLayer: Map<height, Occluder[]>

Entity rendering must resolve each entity to exactly one discrete height layer.

## Migration Plan

## Phase 1: Data Classification Only

Goal: Remove ambiguity without changing visual output.

Instructions:

* Rename existing "curtain" data internally to legacyCurtains.
* During map compilation:

  * Floor and stair background sprites are classified as APRONS.
  * Wall geometry is classified as OCCLUDERS.
* Store APRONS and OCCLUDERS in separate per-layer collections.
* Keep the existing renderer behavior temporarily.

No rendering logic changes are allowed in this phase.

## Phase 2: Renderer Pass Split

Goal: Enforce the new per-layer render order.

Instructions:

* Replace the existing render loop with a strict per-layer loop:

  For each layer L in ascending order:

  * draw APRONS(L)
  * draw TOPS(L)
  * draw ENTS(L)
  * draw OCCLUDERS(L)

* Remove any shared draw queues between passes.

* Remove any logic that merges or reorders layers implicitly.

* The list of layers to render must be computed as the union of:

  * apron layers
  * top layers
  * entity layers
  * occluder layers

All sorting inside a pass must be stable and deterministic.

## Phase 3: Entity Layer Resolution

Goal: Ensure entities never escape their height bucket.

Instructions:

* Every entity resolves to exactly one discrete height layer.
* Player layer equals the height of the surface they stand on.
* Projectile layer equals the layer of the entity that spawned it.
* Remove all pixel-based Z offset hacks that imply cross-layer rendering.

## Phase 4: Cleanup

Goal: Remove obsolete concepts.

Instructions:

* Delete all remaining references to "curtains".
* Remove debug overlays and helpers that assume mixed apron and wall behavior.
* Remove legacy layer-union hacks and special cases.

## Design Guarantees After Migration

* Height order alone defines visibility.
* No entity can appear above a higher floor.
* Occlusion is explicit and limited to walls.
* The renderer is predictable, debuggable, and extensible.

This document is a binding contract. All renderer changes must conform to it.
