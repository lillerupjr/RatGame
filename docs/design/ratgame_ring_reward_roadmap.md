# RatGame Roadmap — Rings, Rewards, and Run Progression

Status: Draft / planning document  
Owner intent: Capture the current roadmap thoughts before implementation ordering and contracts are split out.  
Scope: Ring system expansion, reward-map progression, token/modifier systems, starter upgrades, and ring visuals.

---

## 0. Purpose

This document captures the current high-level roadmap for the next major RatGame progression pass.

The core direction is to make the ring system the central run-building mechanic. The player should care about:

- finding new rings,
- finding rare chase rings,
- improving equipped rings,
- modifying hands/fingers/ring slots,
- making route choices on the Slay-the-Spire-style map,
- and occasionally accepting high-risk/high-reward event outcomes.

The roadmap should be implemented incrementally. The first priority is to make the ring pool and reward loop scalable before adding more complicated event and hand/finger systems.

---

## 1. Overall Implementation Order

Recommended order:

1. Ring data model cleanup
2. Full ~70 ring pool
3. Ring tiering and weighted reward selection
4. StS map reward type visibility
5. Ring reward nodes
6. Token reward nodes
7. Ring level-up token system
8. Family boon pools / choice-of-3 upgrades
9. Basic `?` event framework
10. Starter ring upgrade events
11. Hand/finger modification tokens
12. Compositional ring asset system

The strongest current design preference is:

> Do not build the full per-ring talent tree as V1.  
> Instead, build: ring level-up token → select equipped ring → choose 1 of 3 family boons.

This should provide most of the same depth with less UI friction and lower implementation risk.

---

## 2. Full Ring Set

### Goal

Implement the full V1/V2-scale ring set of roughly 70 rings, including the original 29 rings already implemented.

### Design thoughts

The ring pool should be large enough that runs feel different and that tier weighting matters. The original 29 rings are not excluded from the final roadmap; they are part of the full pool.

The first implementation pass should not aim for perfect balance. It is more important to get all rings represented, selectable, testable, and compatible with the reward system.

Current source pool: 49 shipped authored rings, including 44 normal reward-eligible rings and 5 starter-only rings. The active non-block target is 65 authored rings before the deferred block reserve.

### Implementation implications

The ring definition format should support:

- stable ring id,
- display name,
- description,
- tier,
- family id,
- tags,
- main effect,
- future upgrade hooks,
- future asset metadata,
- and future modifier/enchantment hooks.

This should happen before adding many new rings, to avoid rewriting the pool later.

### Status

- [x] Audit current shipped ring pool.
- [x] Decide final target list for ~70-ring pool.
- [x] Update ring data shape if needed.
- [x] Ship projectile stat expansion batch: Sharpened Tip, Ricochet Rounds, Scatter Shot.
- [x] Ship conditional combat-rule batch: Close Quarters Guard, Pure Force, Physical Devotion.
- [x] Ship health/floor lifecycle batch: Floor Recovery, Vital Force, Wounded Fury.
- [x] Ship reward manipulation batch: Wider Selection, Curated Rewards, Selective Hand.
- [ ] Add missing new rings.
- [ ] Verify all rings appear correctly in reward selection and UI.

---

## 3. Ring Tiering and Rarity

### Goal

Add a tiering system where ring rarity is a major part of balance.

The current tentative tiers are:

| Tier | Meaning | Tentative shown-ring chance |
|---|---|---:|
| T0 | Chase rings / extremely rare | 1% |
| T1 | Very rare / strong | 5% |
| T2 | Uncommon / notable | 25% |
| T3 | Common / baseline | Remaining |

### Design thoughts

T0 rings should be a big deal. The player should feel lucky and excited when one appears.

The desired run feeling:

- many runs have 0 T0 rings,
- some runs have 1 T0 ring,
- rare runs have 2 T0 rings,
- extremely rare runs have 3 T0 rings.

Current approximate target feeling:

- 0 T0 rings should be common,
- 2 T0 rings should be around 1 in 20 runs,
- 3 T0 rings should be around 1 in 100 runs.

The exact math is not locked. The important design principle is locked:

> It is okay for some rings to be overpowered if they are equally rare.

This is considered a strong roguelike feature. Drop chance can be used as a balancing lever for exciting, overpowered build-defining effects.

### Implementation implications

Tier weights should be data-driven and easy to tune. Avoid hardcoding rarity math deeply into reward logic.

### Status

- [x] Add tier field to all ring definitions.
- [x] Add reward weighting by tier.
- [x] Add debug visibility for reward roll/tier selection.
- [ ] Tune T0/T1/T2/T3 weights after playtesting.
- [ ] Check expected T0 frequency over a full run.

---

## 4. StS Map Reward Type Visibility

### Goal

The Slay-the-Spire-style map should show what type of reward a floor grants before the player enters it.

### Reward types

Initial visible reward categories may include:

| Reward Type | Meaning |
|---|---|
| Ring | Floor grants a ring reward |
| Token | Floor grants a hand/ring modification token |
| Event | Special `?` event |
| Shop | Vendor / purchase node |
| Rest | Heal / recovery node |
| Boss | Boss encounter |
| Unknown/New | Placeholder for future reward categories |

### Design thoughts

The map should create routing decisions. The player should choose paths based on what their build needs:

- go toward rings when they need new build pieces,
- go toward tokens when they want to improve existing rings,
- go toward events for risky transformations,
- go toward shops/rests for economy or survival.

This should be implemented before the full event system, because reward visibility is a map-level foundation.

### Status

- [ ] Add reward type metadata to map nodes.
- [ ] Display reward type on the map.
- [ ] Connect ring reward nodes to actual ring reward flow.
- [ ] Connect token reward nodes to token reward flow.
- [ ] Add placeholder display for future node types.

---

## 5. Ring Reward Nodes

### Goal

Create a simple ring reward flow for map nodes that grant rings.

### V1 behavior

1. Player completes a floor with reward type `Ring`.
2. Game shows 3 ring choices.
3. Player chooses 1.
4. Ring is equipped into an empty slot or replaces an equipped ring, depending on current ring UI rules.
5. Tier weighting affects which rings can appear.

### Design thoughts

This is the most important reward type to get working first, because it validates:

- the full ring pool,
- the tiering system,
- the equipment UI,
- and the run-build loop.

### Status

- [ ] Create ring reward node completion flow.
- [x] Generate 3 weighted ring choices.
- [ ] Respect ring slot/equipment rules.
- [ ] Prevent duplicate or unwanted reward behavior if needed.
- [ ] Add debug tools for reward generation.

---

## 6. Hand / Ring Modification Token System

### Goal

Create a full V1 version of the hand/ring modification token system.

After completing a floor, the player can receive a token/buff that can be used on hands, fingers, or rings.

### Example token effects

Ring-focused examples:

- add +1 level to a ring,
- enchant a ring to be 20% more effective,
- modify a ring’s main effect,
- grant a family-specific boon,
- potentially add passive points if any ring tree system survives in the future.

Hand/finger-focused examples:

- modify a hand,
- modify a finger,
- add or alter a ring slot,
- sacrifice or transform a finger,
- apply a modifier to all rings on one hand.

### Design thoughts

Tokens should be part of the main progression loop, not a side feature.

The player should sometimes prefer improving the current build over taking a new ring. This makes map route choice more meaningful.

### V1 priority

Start with ring-level tokens before hand/finger tokens.

Recommended first token types:

1. Level up selected ring.
2. Enchant selected ring for +20% effect.
3. Possibly add a simple family modifier.

Hand/finger tokens should come later, because they affect more systems and are likely to create more UI and balance complexity.

### Status

- [ ] Define token data model.
- [ ] Add token reward node completion flow.
- [ ] Add UI for selecting a target ring.
- [ ] Implement basic ring level-up token.
- [ ] Implement basic +20% enchant token.
- [ ] Defer advanced hand/finger tokens until ring tokens work.

---

## 7. Ring Family Progression / Talent Tree Alternative

### Original idea

Each ring could have its own family-dependent talent tree. The player would open a tree for a specific ring and spend points into upgrades related to that ring’s family.

Example:

- physical rings have physical-themed upgrades,
- poison rings have poison-themed upgrades,
- projectile rings have projectile-themed upgrades,
- ignite rings have burn-themed upgrades.

### Current concern

This idea is not currently preferred for V1.

Concerns:

- It may be too heavy for the player.
- It requires opening a separate tree for each ring.
- It creates a lot of UI complexity.
- The choices may feel arbitrary.
- It may slow down the reward flow.
- It may not add enough benefit compared with a simpler system.

### Preferred alternative

Use ring level-up tokens.

Flow:

1. Player receives a level-up token.
2. Player selects an equipped ring.
3. Game presents family-related upgrade options.
4. Player chooses a boon.
5. The boon is attached to that ring for the current run.

Preferred V1 version:

> Level-up token → select ring → choose 1 of 3 family boons.

This keeps player agency while avoiding a full mini talent tree UI.

### Design thoughts

This system should be easier to understand, faster to play, and more player-friendly while still adding the same kind of build depth.

It also makes ring families matter without requiring a large custom UI for every ring.

### Open questions

- Should pure random boons ever be used, or should V1 always offer choice-of-3?
- Can a ring receive multiple boons in one run?
- Are boon pools family-only, ring-specific, or mixed?
- Are boons run-only or meta-persistent?
- Should full talent trees remain a possible future expansion?

### Status

- [ ] Do not implement full per-ring talent trees for V1.
- [ ] Define ring family boon pools.
- [ ] Implement choice-of-3 boon selection.
- [ ] Attach selected boon to the chosen ring.
- [ ] Display ring boons clearly in ring UI.

---

## 8. Family Boon Pools

### Goal

Create small family-dependent boon pools that can be used by ring level-up tokens.

### Example boon families

#### Projectile family

Possible boons:

- +1 pierce,
- +1 bounce,
- increased projectile speed,
- chance to split,
- extra projectile with reduced damage.

#### Poison family

Possible boons:

- increased poison duration,
- increased poison damage,
- poisoned enemies deal less damage,
- poison spreads on death,
- chance to leave poison trail.

#### Ignite family

Possible boons:

- increased ignite duration,
- burning enemies are slowed,
- fire explosion chance,
- increased damage against burning enemies.

#### Physical family

Possible boons:

- empowered next shot,
- increased physical damage,
- chance to knock back,
- improved critical scaling,
- stronger periodic attack.

### Design thoughts

Start small. The goal is not to build huge trees. The goal is to create enough family identity that ring leveling feels meaningful.

Each family pool can grow over time.

### Status

- [ ] Define initial family list.
- [ ] Define 3-6 boons per major family.
- [ ] Add boon application logic.
- [ ] Add boon display text.
- [ ] Add balance/debug tools.

---

## 9. StS-Style `?` Events

### Goal

Add event nodes inspired by Slay the Spire `?` events.

These events should allow the player to make unusual run-shaping decisions, especially around rings, ammunition, health, gold, and sacrifice mechanics.

### Example event ideas

- Sell a ring for gold.
- Swap physical ammunition to chaos ammunition.
- Gain incendiary rounds.
- Get a powerful ring but lose a random ring.
- Pay 100 gold to get a random ring.
- Heal 50 but lose 10% max life.
- Quest: take no damage on the next floor and receive a reward.
- Sacrifice a finger to gain something powerful.
- Swap starter ring for a stronger upgraded version.

### Design thoughts

Events are where the game can be weird, risky, and memorable.

However, event implementation should come after basic ring rewards and token rewards. The event framework should be built before adding many events.

### Open design question

It is not locked whether upgrades outside the ring system should be allowed.

Current tentative direction:

> Keep the ring system central, but allow some events to temporarily or permanently modify other parts of the run if the outcome is exciting enough.

This should remain tentative until the first event framework exists.

### Status

- [ ] Create event node type.
- [ ] Create event data model.
- [ ] Support 2-3 choices per event.
- [ ] Support requirements/costs.
- [ ] Support outcomes.
- [ ] Implement a small first event set.
- [ ] Add starter upgrade event after framework exists.

---

## 10. Powerful Starter Ring Upgrades

### Goal

Create special upgraded versions of starter rings, likely through event rewards.

### Current upgrade ideas

| Starter | Upgrade idea |
|---|---|
| Jack | Every 5th shot becomes a big missile |
| Scratchy | Leaves a poison trail |
| Tommy | Rubber bullets: gain +1 bounce |
| Jamal | Improve existing version to 3 knives instead of 1, targeting different enemies if possible |
| Joey | Needs rework |

### Design thoughts

Starter upgrades should probably not be normal ring rewards. They feel better as special event outcomes because they connect to the player’s starting identity.

The upgrade should feel powerful and build-defining.

### Open questions

- Are starter upgrades replacement rings, enchantments, or transformed starter rings?
- Can every starter get exactly one upgrade path, or multiple?
- Should starter upgrade events be rare?
- Does the starter ring remain mandatory/equipped after upgrading?
- What is Joey’s identity?

### Status

- [ ] Define starter upgrade representation.
- [ ] Implement Jack upgrade.
- [ ] Implement Scratchy upgrade.
- [ ] Implement Tommy upgrade.
- [ ] Implement Jamal upgrade.
- [ ] Rework Joey.
- [ ] Add starter upgrade event.

---

## 11. Hand/Finger Modification Tokens

### Goal

Expand tokens beyond rings into hand and finger modifications.

### Possible effects

- Add a temporary ring slot.
- Upgrade a specific finger slot.
- Sacrifice a finger for a powerful boon.
- Modify all rings on one hand.
- Add special behavior to left hand or right hand.
- Add a cost/curse to one finger in exchange for power.

### Design thoughts

This system is potentially very powerful and flavorful, but it is also more complex than ring-level tokens.

It should come after ring token V1 works.

The fantasy is strong: the player is not just collecting rings, they are mutating and sacrificing parts of their hand setup.

### Status

- [ ] Defer until ring-level token system works.
- [ ] Define hand/finger data model if missing.
- [ ] Define target selection UI.
- [ ] Implement one simple positive hand token.
- [ ] Implement one sacrifice/risk token.
- [ ] Evaluate whether this system is too complex for V1.

---

## 12. Ring Asset System

### Goal

Create a compositional ring asset system.

Ring visuals should be built from tier and family identity.

### Proposed visual composition

A ring visual is determined by:

1. Tier band material.
2. Family gemstone/ornament.
3. Tier-based size/wow effect.
4. Optional unique override for special rings.

### Tier band examples

- Bronze
- Silver
- Gold
- Platinum

### Family visual examples

The ring family determines the gemstone, ornament, icon, shape language, or magical effect.

Examples:

- poison family could use green gem/toxic ornament,
- ignite family could use ember/fire ornament,
- projectile family could use sharp/angular ornament,
- chaos family could use unstable or strange gem effects.

### T0 unique designs

Future direction:

> T0 rings should eventually have unique handcrafted designs.

V1 can still use compositional assets for T0 if needed, but the system should allow unique visual overrides later.

### Design thoughts

This should probably not be implemented too early. The gameplay systems should define the asset needs first.

However, ring tier and family metadata should be added early so the asset system has the data it needs later.

### Status

- [ ] Add asset metadata hooks to ring definitions.
- [ ] Define tier band materials.
- [ ] Define family ornament/gem mapping.
- [ ] Create compositional rendering/generation path.
- [ ] Add unique visual override support.
- [ ] Later: create unique T0 ring designs.

---

## 13. Progress Tracker

### Phase 1 — Ring foundation

- [ ] Clean up ring data model.
- [ ] Support tier/family/tags/effect/asset/upgrade metadata.
- [ ] Add full ~70 ring pool.
- [ ] Keep original 29 rings in the final pool.
- [ ] Add tier weights.

### Phase 2 — Reward loop

- [ ] Add map reward type visibility.
- [ ] Add ring reward nodes.
- [ ] Add token reward nodes.
- [ ] Add reward debug tools.

### Phase 3 — Ring progression

- [ ] Add ring level-up token.
- [ ] Add +20% enchant token.
- [ ] Add family boon pools.
- [ ] Add choice-of-3 boon UI.
- [ ] Show boons on rings.

### Phase 4 — Events

- [ ] Add `?` event framework.
- [ ] Add first small event set.
- [ ] Add starter ring upgrade events.
- [ ] Add quest-style event outcomes.

### Phase 5 — Hand/finger expansion

- [ ] Add hand/finger target model.
- [ ] Add simple hand/finger token.
- [ ] Add sacrifice-style token.
- [ ] Evaluate complexity and player clarity.

### Phase 6 — Ring visuals

- [ ] Add compositional ring asset system.
- [ ] Add tier-based bands.
- [ ] Add family-based ornaments/gems.
- [ ] Add future unique T0 override support.

---

## 14. Current Locked / Candidate / Open Decisions

### Locked / strong direction

- The ring system is the center of run progression.
- The final roadmap includes around 70 rings, including the original 29.
- Player baseline is 8 ring slots.
- Ring rarity is a valid balance lever.
- T0 chase rings should feel extremely rare and exciting.
- StS map reward type visibility is important.
- Token rewards should exist as a major reward category.

### Candidate decisions

- T0/T1/T2/T3 weights start around 1% / 5% / 25% / remaining.
- Ring level-up should offer choice-of-3 family boons.
- Starter upgrades should be special event outcomes.
- Ring visuals should be compositional by tier + family.
- T0 rings should eventually get unique visuals.

### Open decisions

- Exact rarity math across a full run.
- Whether events can grant non-ring upgrades.
- Whether ring boons are always choice-of-3 or sometimes random.
- Whether a ring can receive multiple boons.
- Whether boons are run-only or meta-persistent.
- Joey starter upgrade identity.
- Exact hand/finger token scope for V1.
- Whether full ring talent trees remain a future feature or are fully abandoned.

---

## 15. Notes for Future Contracts

When turning this roadmap into implementation contracts, split into smaller contracts:

1. Ring data/tiering contract.
2. Ring reward node contract.
3. Token reward contract.
4. Family boon/level-up contract.
5. Event framework contract.
6. Starter upgrade event contract.
7. Hand/finger token contract.
8. Ring asset system contract.

Avoid one massive implementation contract. The systems touch too many parts of the game and should be implemented in phases.
