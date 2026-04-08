# Historical Contract: Enemy System Refactor Design

## Status

- Classification: `Partially stale`
- Important design invariants extracted: `Yes`
- Do not use this contract as current system truth.

## Current Canonical Truth

- `docs/canonical/hostile_ai_spawn_runtime.md`
- `docs/canonical/core_simulation_combat_runtime.md`

## Still-Valid Historical Decisions

- Static hostile metadata is centralized in enemy content definitions rather than scattered across runtime systems.
- Runtime hostile behavior state is stored separately from static enemy data.
- Hostile behavior selection, movement consumption, actions, and death handling remain shared-system responsibilities rather than bespoke per-enemy ownership paths.
- Movement and non-contact hostile abilities remain decoupled.
- Standard hostile contact damage remains outside hostile action authoring and is resolved in the shared collision/simulation path.

## Known Drift / Stale Parts

- The implemented system uses the concrete `EnemyDefinition` / `EnemyBrainState` shapes in code, not the exact proposed `EnemyArchetype` and brain-type shapes from this document.
- The live state names and runtime fields differ from the proposal:
  - live states use `move` instead of `chase` / `hold_range`
  - leap transients are explicit shared brain fields
- The proposal included a separate perception layer and modular contact-damage action model; the live system instead keeps contact damage collision-driven and computes range checks inside hostile behavior/movement consumers.
- This document was a refactor target and migration plan, not the final implemented architectural description.

## Historical Implementation Notes

- This contract captured the central move toward data-driven hostile definitions plus shared AI/movement/action systems.
- Its lasting value is the static-vs-runtime split and the rule that hostile behavior should extend shared systems rather than reintroducing enemy-specific architectural branches.
