# RatGame V1 Backend Contract — Ring / Hand Progression

## Status

LOCKED for V1 backend baseline.

This contract defines the minimal backend shape for the V1 ring / hand progression system.
Its purpose is to keep the implementation narrow, avoid reward-system creep, and preserve the intended separation between rings, modifier tokens, and hand effects.

---

## Goal

Provide a small, stable backend model for:

* ring state
* shared ring-family talent trees
* stored modifier tokens
* immediate hand/finger structural effects

V1 should implement only the minimum needed for the locked progression design.

---

## Core Ring Model

Use a split between:

* static ring definition data
* runtime ring instance state
* shared family talent tree definition

### RingDef

Static authored ring content.

Fields should include at least:

* `id`
* `name`
* `familyId`
* `tags`
* `effectType`
* `effectParams`

Intent:

* `familyId` points to a shared family tree such as poison, projectile, etc.
* the ring’s main authored effect lives here

### RingInstance

Runtime state for one equipped ring.

Fields should include at least:

* `instanceId`
* `defId`
* `slotId`
* `allocatedPassivePoints`
* `increasedEffectScalar`
* `unlockedTalentNodeIds`

Intent:

* `allocatedPassivePoints` represents passive points granted through level-up tokens and available for the ring’s family tree
* `increasedEffectScalar` stores the accumulated scaling to the ring’s main modifier numerical values
* `unlockedTalentNodeIds` stores chosen family-tree nodes for this ring instance

Do not copy the family tree onto each ring instance.
The ring instance should store only its state and chosen node ids.

### RingFamilyTalentTreeDef

Shared family tree definition used by all rings in the same category/family.

Fields should include at least:

* `familyId`
* `nodes`

Each node should define at least:

* `id`
* `name`
* `description`
* `requiresNodeIds`
* optional numerical or tag modifiers

---

## Family Tree Rule

A ring’s talent tree is not unique per ring.
It comes from the ring’s `familyId`.

Examples:

* poison rings use the poison family tree
* projectile rings use the projectile family tree

This is LOCKED for V1.
It prevents content explosion and keeps the modifier-token system manageable.

---

## V1 Modifier Tokens

Only the following ring modifier tokens exist in V1:

### 1. Level-Up Token

Purpose:
Adds one passive point to a ring.

Effect:

* increase the selected ring’s `allocatedPassivePoints` by 1
* the player may then allocate that point in the ring’s family talent tree according to legal node requirements

This is the only V1 token used to advance the ring skill tree.

### 2. 20% Increased Effect Token

Purpose:
Scales the numerical values of the ring’s main modifier.

Effect:

* applies +20% increased effect to the selected ring’s main authored effect
* this should modify the ring instance’s `increasedEffectScalar`

Intent:

* this is a clean numerical scaling token
* it affects the ring’s main modifier values, not the family tree directly

---

## Modifier Token Scope Rule

Do not add extra token types in V1.

Specifically excluded from V1:

* quality tokens
* retune / respec tokens
* family conversion tokens
* poison-fy / projectile-fy conversion tokens
* generic behavior-conversion token sets

The point of V1 is to keep modifier rewards narrow and readable.

---

## V1 Hand / Finger Effects

Only the following capacity/finger effects are included in V1:

### 1. Add Finger

Purpose:
Increase ring capacity.

Effect:

* adds one finger slot to the chosen hand

### 2. Empower Finger

Purpose:
Create a stronger structural slot.

Effect:

* applies an empowerment modifier to a chosen finger slot
* a ring equipped in that slot gains the finger’s empowerment bonus

The exact empowerment scalar/value is still implementation detail, but the effect type itself is LOCKED.

---

## Hand Effect Scope Rule

Do not add more hand-effect variants in V1.

Specifically excluded from V1:

* left/right hand global bonus effects
* locked finger effects
* dual-slot fingers
* cursed fingers
* finger conversion or neighbor-linking effects

The V1 hand system should stay focused on:

* capacity increase
* single-slot empowerment

---

## Suggested Runtime Containers

The runtime equipment/progression state should be able to represent at least:

* hands
* finger slots
* equipped ring instances
* stored modifier tokens

A hand/finger model should support:

* baseline 4 fingers per hand
* additional fingers being appended later
* per-finger modifiers such as empowerment

A top-level progression/equipment state should support:

* equipped rings by slot
* stored unspent modifier tokens
* finger state and hand state

---

## Locked Decisions

### LOCKED

* backend uses a split between `RingDef`, `RingInstance`, and `RingFamilyTalentTreeDef`
* each ring belongs to a family/category via `familyId`
* family talent trees are shared by family, not authored uniquely per ring
* ring instances store chosen/unlocked node ids, not copied trees
* V1 ring modifier tokens are only:

    * level-up token
    * 20% increased effect token
* the level-up token adds one passive point for allocation in the ring family tree
* the increased effect token scales the numerical values of the ring’s main modifier
* V1 hand/finger effects are only:

    * add finger
    * empower finger
* V1 should keep backend scope narrow and exclude extra token/effect variants

---

## Open Questions

### OPEN

* exact TypeScript interface names and field names
* exact scalar math for `increasedEffectScalar`
* exact empowerment bonus value and stacking rules
* exact talent tree node schema beyond the minimum required fields
* exact UI/application flow for spending passive points on a ring
* whether `allocatedPassivePoints` and spent points should be stored separately, or derived from unlocked node count plus available points

---

## Implementation Intent Summary

If implementation starts drifting, the correct fallback is:

**RatGame V1 backend should model rings as instances of authored ring defs, map each ring to a shared family talent tree, allow only two stored modifier tokens (passive-point gain and +20% main-effect scaling), and support only two hand/finger structural effects (add finger and empower finger).**
