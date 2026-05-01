# RatGame V1 Backend Contract — Ring / Hand Progression

## Status

IMPLEMENTED baseline.

This is the canonical backend contract for the V1 ring / hand progression system.
It defines the current repo truth for progression runtime ownership and the minimum locked V1 backend shape.

---

## Goal

Provide a small, stable backend model for:

* ring state
* shared ring-family talent trees
* stored modifier tokens
* immediate hand/finger structural effects
* centralized passive and triggered ring-effect runtime application

V1 implements only the minimum needed for the locked progression design.

---

## Current Implemented Baseline

These achievements are already true in the current branch and are now canonical:

* ring / hand / token progression is the only runtime progression model
* reward tickets and vendor offers are progression-family only
* passive ring effects are applied through centralized progression runtime effects
* triggered ring effects execute through a progression-owned dispatcher
* combat-rule ring effects execute through a progression-owned combat-rule snapshot
* no relic, card, or separate level-up draft runtime path survives in gameplay or UI
* progression offers are typed backend objects, not string-encoded payload conventions
* malformed progression state is normalized back onto the locked ring-first baseline
* the first authored V1 ring catalog replaces the placeholder sample ring catalog
* starter ring names, descriptions, and baseline behaviors were recovered from git history where available
* run start equips exactly one character starter ring into `LEFT:0`
* the first V1 content pass ships with empty family trees across all V1 ring families
* every shipped V1 ring has smoke coverage across inspection and runtime behavior surfaces

---

## Core Ring Model

Use a split between:

* static ring definition data
* runtime ring instance state
* shared family talent tree definition

### RingDef

Static authored ring content.

Fields include:

* `id`
* `name`
* `description`
* `tier`
* `familyId`
* `tags`
* `mainEffect`

Intent:

* `familyId` points to a shared family tree such as poison or projectile
* the ring’s main authored effect lives here
* `mainEffect` is the only canonical field for authored ring behavior; redundant `effectType` / `effectParams` fields are not allowed
* `tier` is locked to `1` in the first authored V1 content pass

### RingInstance

Runtime state for one equipped ring.

Fields include:

* `instanceId`
* `defId`
* `slotId`
* `allocatedPassivePoints`
* `increasedEffectScalar`
* `unlockedTalentNodeIds`

Intent:

* `allocatedPassivePoints` represents passive points granted through stored level-up tokens
* `increasedEffectScalar` stores accumulated scaling to the ring’s main authored effect
* `unlockedTalentNodeIds` stores chosen family-tree nodes for this ring instance

Do not copy the family tree onto each ring instance.
The ring instance stores only its own mutable state and chosen node ids.

### RingFamilyTalentTreeDef

Shared family tree definition used by all rings in the same family.

Fields include:

* `familyId`
* `nodes`

Each node defines at least:

* `id`
* `name`
* `description`
* `requiresNodeIds`
* `cost`
* `effect`

---

## Family Tree Rule

A ring’s talent tree is not unique per ring.
It comes from the ring’s `familyId`.

Examples:

* poison rings use the poison family tree
* projectile rings use the projectile family tree

This is LOCKED for V1.

### Current V1 Families

The current backend family list is:

* `starter`
* `generic`
* `physical`
* `dot`
* `chaos`
* `poison`
* `projectile`
* `ignite`
* `crit`
* `trigger`
* `defense`
* `utility`

The first authored V1 content pass may leave a family without authored rings, but every family must still ship an empty family tree definition so the family list stays canonical.

---

## V1 Modifier Tokens

Only the following stored ring modifier tokens exist in V1:

### 1. Level-Up Token

Effect:

* increases the selected ring’s `allocatedPassivePoints` by 1

### 2. 20% Increased Effect Token

Effect:

* applies +20% increased effect to the selected ring’s main authored effect
* modifies the ring instance’s `increasedEffectScalar`

Do not add additional token families in V1.

---

## V1 Hand / Finger Effects

Only the following immediate hand effects exist in V1:

### 1. Add Finger

Effect:

* adds one finger slot to the chosen hand

### 2. Empower Finger

Effect:

* adds an empowerment modifier to a chosen finger slot
* a ring equipped in that slot gains the finger’s empowerment bonus

Do not add additional hand-effect families in V1.

---

## Runtime Containers

The progression runtime must represent at least:

* hands
* finger slots
* equipped ring instances
* stored modifier tokens
* progression reward state
* progression reward tickets

A hand / finger model supports:

* baseline 4 fingers per hand
* extra fingers appended later
* per-finger empowerment
* a starter ring equip target of `LEFT:0`

Top-level progression state supports:

* equipped rings by slot
* stored unspent modifier tokens
* finger and hand state

### Starter Loadout Rule

Character starter loadout wiring is separate from ring authoring but it is part of the implemented runtime baseline.

Locked truths:

* a new run equips exactly one starter ring for the selected character
* the starter ring is equipped directly into `LEFT:0`
* no starter ring inventory, pickup, or alternate starter-ring ownership path exists in V1

---

## Effect Runtime Rule

Passive and triggered ring behavior must route through centralized progression effect primitives.

LOCKED truths:

* `STAT_MODIFIERS` is the canonical passive stat path
* ring main effects and unlocked talent nodes both emit runtime effects
* triggered ring effects execute through the progression trigger dispatcher
* `COMBAT_RULES` is the canonical non-passive, non-hand rule surface for combat-owned ring behavior
* hand structure effects are authored through progression effect definitions but mutate hand state through dedicated hand mutators

Do not reintroduce separate relic-effect, card-passive, or ad hoc combat hook pipelines.

### Triggered Action Surface

The current authored trigger action surface includes:


* numeric resource gain actions
* projectile proc actions
* death explosion actions
* ignite spread-on-death actions
* ignite-from-hit actions

This surface is ring-owned. Old relic-trigger ownership must not return.

### First V1 Content Pass

The first authored V1 content pass is intentionally narrow:

* every authored ring is `tier: 1`
* every family tree exists
* every family tree is empty
* no passive nodes are authored yet
* ring content is canonical under the ring registry only

---

## Reward / Vendor Rule

Reward generation and vendor generation both consume typed progression options.

LOCKED truths:

* progression reward families are only:
  * `RING`
  * `RING_MODIFIER_TOKEN`
  * `HAND_EFFECT`
* offers are typed backend objects with structured payloads
* reward or vendor code must not depend on string-parsed payload ids to recover behavior

---

## Validation / Normalization Rule

Progression content and runtime state must be sanitized centrally.

Required validation coverage:

* duplicate ring ids
* unknown families
* duplicate node ids
* missing prerequisites
* cyclic prerequisites
* invalid effect defs
* invalid trigger keys

Required runtime normalization coverage:

* rebuild missing hands / baseline slots
* clamp stored token counts
* discard unknown ring defs
* discard unknown or illegal unlocked nodes
* clear orphaned slot refs
* preserve only valid ring-slot ownership

No migration bridge from relic/card progression saves is supported.
Old progression state resets to the clean ring baseline.

---

## Locked Decisions

### LOCKED

* backend uses a split between `RingDef`, `RingInstance`, and `RingFamilyTalentTreeDef`
* each ring belongs to a family through `familyId`
* family talent trees are shared by family, not authored uniquely per ring
* ring instances store chosen node ids, not copied trees
* V1 ring modifier tokens are only:
  * `LEVEL_UP`
  * `INCREASED_EFFECT_20`
* V1 hand/finger effects are only:
  * `ADD_FINGER`
  * `EMPOWER_FINGER`
* V1 uses typed progression offers instead of string-decoded reward payloads
* V1 uses centralized progression runtime effects for passive and triggered ring behavior
* V1 does not preserve legacy relic/card progression compatibility paths

---

## Implementation Intent Summary

If implementation starts drifting, the correct fallback is:

**RatGame V1 backend models rings as instances of authored ring defs, maps each ring to a shared family talent tree, allows only two stored modifier tokens and two hand effects, routes passive and triggered behavior through centralized progression effect primitives, and treats typed progression offers as the only backend-facing reward / vendor payload shape.**
