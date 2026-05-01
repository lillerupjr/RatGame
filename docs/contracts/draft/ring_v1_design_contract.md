# RatGame V1 Progression Contract — Ring / Hand Reward System

## Status

LOCKED for V1 design baseline.

This contract defines the intended V1 progression shape for RatGame. It exists to prevent regression back into overlapping systems such as level-up card rewards, relic layering, or passive-tree-first progression. V1 should stay mechanically simple, strategically legible, and modular for later expansion.

---

## Goal

Build a clean progression system around end-of-floor reward choices, with rings as the core build identity and hand structure as the long-term capacity axis.

The system should:

* Give the player at least one reward per floor
* Preserve the core floor-completion loop
* Support simple side content without reward bloat
* Create strategic routing decisions through the run map
* Be expandable later without rewriting the V1 foundation

---

## Core Run Structure

A run consists of floors.
Each floor has an objective.
Completing the objective ends the floor.
At the end of the floor, the player chooses exactly **1 of 3 rewards**.

For V1, this end-of-floor reward choice is the main progression event.

---

## Ring / Hand Baseline

A rat has 4 fingers on each hand.
Baseline capacity is therefore **8 ring slots total**.

Rules:

* There is **no ring inventory**
* A newly chosen ring must either:

    * go into an empty finger, or
    * replace an already equipped ring
* Rings are therefore always part of the live build state

This no-inventory rule is a key design constraint and should not be bypassed in V1.

---

## V1 Reward Families

Every normal reward belongs to one of three families:

### 1. Rings

Purpose: build identity

A Ring reward offers 3 ring choices at end of floor.
The player picks 1.
The chosen ring is immediately equipped into an empty finger or replaces an equipped ring.

Rings are the main source of build-defining effects.

---

### 2. Ring Modifier Tokens

Purpose: targeted scaling and refinement

A Modifier reward offers 3 modifier token choices at end of floor.
The player picks 1.
The chosen reward is a **stored token**, not an instant effect.

Token intent:

* The player can spend the token later on a chosen ring
* Tokens allow targeted growth instead of forcing immediate commitment on the reward screen

V1 modifier token examples may include:

* level-up token
* quality-up token
* a small number of special tag/behavior conversions

Modifier floors should stay restrained in V1. Do not explode token variety too early.

---

### 3. Hand / Finger Modifier Effects

Purpose: structural change to ring capacity or ring topology

A Hand reward offers 3 hand/finger effect choices at end of floor.
The player picks 1.
The chosen reward applies immediately.

Examples:

* +1 finger
* empower a finger
* alter a finger or hand with a special property

For V1, these are **effects**, not stored tokens.
This is important for keeping reward-family identity clean:

* Modifier rewards = stored, targeted, spend later
* Hand rewards = immediate structural effect

---

## Reward Family Identity Rule

Each reward family must solve a different progression problem:

* Rings answer: **what is my build?**
* Modifier tokens answer: **how do I improve a ring I already care about?**
* Hand/finger effects answer: **how much capacity or structure does my build have?**

Avoid overlap that makes categories blurry.
For example, do not let hand rewards become generic ring upgrades, and do not let modifier tokens fully replace structural progression.

---

## Floor Reward Category Visibility on the Run Map

The run map should show the primary reward category of upcoming floors.

At minimum, V1 map nodes should visibly communicate whether a floor is:

* a Ring floor
* a Modifier floor
* a Hand floor

This is a locked part of the design direction.
The purpose is to make routing strategic.

Desired strategic arc:

* Ring floors are generally more valuable early when the player is still assembling a build
* Modifier floors become more attractive once the player has rings worth investing into
* Hand floors gain value as structural expansion and specialization become more important

This category visibility is not decoration; it is part of the gameplay.

---

## One Primary Reward Family Per Floor

For V1, each floor has exactly **one primary reward family**.

That means:

* Ring floor -> end reward is ring-only
* Modifier floor -> end reward is modifier-only
* Hand floor -> end reward is hand-only

Do not mix reward families in standard floor rewards for V1.
This keeps the map legible and preserves strategic routing.

---

## End-of-Floor Reward Invariant

Each floor ends with exactly one main reward pick.

V1 invariant:

* one reward screen
* three options
* choose one

Do not add extra major reward screens to normal floor flow in V1.

---

## Moments and Side Objectives

V1 should support light mid-floor reward variation, but it must remain simple.

### Design intent

Moments and side objectives exist to make floors more dynamic and to create expansion space for later systems.
However, in V1 they should **enhance the main end-of-floor reward**, not create fully separate parallel progression tracks.

### V1 rule

Moments and side objectives should usually modify the anchor reward flow in small, understandable ways.

Good V1 outputs include:

* improving the quality of one or more end-of-floor options
* adding a 4th option to the final reward screen
* granting a reroll
* granting a small bonus token
* biasing one offered reward toward current build state

Avoid introducing a second full reward economy through moments/side objectives in V1.

---

## Side Objective Reward Constraint

A side objective should not overshadow floor completion as the primary progression event.

For V1:

* floor completion remains the anchor progression source
* side objectives are optional enhancers or small bonuses
* side rewards should not multiply into reward bloat

This is especially important for scaling discipline.

---

## Simplicity Rule for V1

Do not stack the old progression patterns back on top of this system.

Specifically, V1 should avoid reintroducing any parallel system that effectively behaves like:

* vampire-survivor-style level-up card drafting on top of ring rewards
* relic rewards as a second major end-of-floor economy
* passive-tree/jewel-routing that overrides or dilutes ring/hand decisions

The point of V1 is not to create another layered roguelike reward pile.
The point is to make the ring/hand system the primary progression backbone.

---

## Expansion-Friendly Boundaries

V1 should be implemented in a way that allows later expansion into:

* more sophisticated moments
* richer side objectives
* broader token variety
* special ring classes
* removable vs non-removable ring variants
* additional hand topology / mutation systems
* more advanced map-routing strategy

But those should be expansions of the V1 backbone, not reasons to blur V1.

---

## Recommended V1 Strategic Arc

This is a design intent, not a strict numeric table.

Expected natural valuation through a run:

* early floors: Ring floors usually feel strongest
* mid floors: Rings and Modifiers compete more evenly
* later floors: Modifier and Hand floors often become more desirable if the build core is already assembled

Map generation and reward pacing should support this arc where practical.

---

## Locked Decisions

### LOCKED

* V1 uses end-of-floor **pick 1 of 3** as the main reward interaction
* V1 reward families are **Rings**, **Ring Modifier Tokens**, and **Hand/Finger Modifier Effects**
* Baseline ring capacity is **8 total slots** from 4 fingers on each hand
* There is **no ring inventory**
* New rings must be equipped immediately into an empty slot or replace an equipped ring
* Reward family of a floor is visible on the run map
* Each floor has exactly one primary reward family
* Normal floor rewards do not mix families in V1
* Modifier rewards are **stored tokens**
* Hand rewards are **immediate effects**
* Moments and side objectives exist in V1, but in a simple form
* Moments and side objectives should primarily **enhance the main floor reward**, not create a separate full reward system
* Floor completion remains the anchor reward source
* V1 should avoid reintroducing layered parallel systems such as level-up cards + relics + passive tree on top of the ring/hand backbone

---

## Open Questions for Later Design Passes

These are intentionally not locked by this contract.

### OPEN

* Exact reward pool contents for each family
* Exact modifier token taxonomy for V1
* Exact hand/finger effect list for V1
* Exact frequency / distribution of Ring vs Modifier vs Hand floors across an act
* Exact boss reward behavior
* Exact implementation of moments
* Exact implementation of side objectives
* Exact UI layout for the end-of-floor reward screen and hand management screen
* How much build-biasing the reward generator should use in V1

---

## Implementation Intent Summary

If future work starts drifting, the correct fallback is:

**RatGame V1 progression is a route-planned reward system where each floor grants one of three upgrade families — new rings, stored ring-upgrade tokens, or immediate hand-structure effects — with one main end-of-floor pick and lightweight side content that enhances, rather than replaces, that core flow.**
