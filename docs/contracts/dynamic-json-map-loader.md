# dynamic-json-map-loader.md

Instruction to LLM

* No time-gated comments
* Contract-style documentation only
* This document is linear and complete
* Each section is a locked architectural step
* Achievements are boolean invariants
* Do not proceed to the next section without user confirmation ("next")

---

## 0. Purpose

Introduce a **dynamic JSON-based map loader** that integrates cleanly with the
existing map compilation pipeline without weakening any rules in AGENTS.md.

This contract validates that the contract system itself works:
- linear execution
- achievement marking
- explicit gating
- no architectural drift

This contract does NOT change gameplay rules, direction semantics, or rendering order.

Achievements
- [x] A JSON-authored map can be loaded without bypassing map compilation.

---

## 1. Scope and non-goals

In scope:
- Loading maps defined in external JSON files.
- Mapping JSON fields to the existing TableMapDef structure.
- Using the existing compile pipeline (TableMapDef -> CompiledMap).

Out of scope:
- Changing render order.
- Introducing new direction semantics.
- Adding new Z roles.
- Procedural generation changes.

Rules
- JSON maps are an authoring format only.
- Runtime systems must remain unaware of JSON.

Achievements
- [x] JSON is treated purely as an authoring layer.

---

## 2. JSON map format (authoring contract)

A JSON map represents the same information as TableMapDef.

Required fields:
- id: string
- width: number
- height: number
- cells: array of cell objects

Cell object fields:
- x: number (table space)
- y: number (table space)
- t: string (tile token, unchanged semantics)

Optional fields:
- defaultFloorSkin
- defaultSpawnSkin
- metadata (free-form, ignored by runtime)

Rules
- JSON coordinates are table-space only.
- JSON must not encode tile-space or screen-space data.
- Direction tokens inside t follow the Direction Contract.

Achievements
- [x] JSON maps can be losslessly converted to TableMapDef.

---

## 3. Loader responsibilities

The JSON loader is responsible only for:
- Reading JSON from disk or network.
- Validating required fields.
- Producing a valid TableMapDef object.

The loader must NOT:
- Compile tiles.
- Assign Z values.
- Perform direction remapping.
- Perform render classification.

Rules
- Loader output must be indistinguishable from hand-written TableMapDef.

Achievements
- [x] The loader produces a valid TableMapDef without side effects.

---

## 4. Integration point

Integration must occur at the same boundary as other maps.

Rules
- JSON-derived TableMapDef enters the system at the same point as authored or procedural maps.
- setActiveMap / compile pipeline remains unchanged.
- No system is allowed to detect whether a map came from JSON.

Achievements
- [x] JSON maps flow through the existing compile pipeline unchanged.

---

## 5. Validation and failure behavior

Rules
- Invalid JSON must fail fast with a clear error.
- Partial or best-effort loading is forbidden.
- Missing required fields is a hard error.

Achievements
- [x] Invalid JSON never produces a partially valid map.

---

## 6. Testing requirements

Rules
- At least one minimal JSON map must be covered by a test.
- The test must assert equivalence with an equivalent TableMapDef map.

Achievements
- [x] JSON loader behavior is covered by at least one focused test.

---

## 7. Step completion and gating

After completing this step:
- Mark all achievements in this section as complete.
- Summarize what is now true.
- State the next step.

Stop execution and wait for user confirmation:
> next

---

## 8. Completion criteria

This contract is complete when:
- All achievements are checked.
- JSON maps can be loaded, compiled, and rendered identically to existing maps.
- No rule in AGENTS.md is violated or weakened.

Final response must state:
- "Contract complete."
