# RatGame Ring Content-Only Implementation

Progress tracker for the strict content-only ring batch.

## Batch Goal

Add the simplest rings that map exactly to current ring systems: static `STAT_MODIFIERS` or existing `COMBAT_RULES`, with no approximation and no new combat mechanics.

Runtime note: this batch originally shipped while authored `RingDef.tier` was locked to `1`; the later ring data tiering contract moved these rings to their design tiers from `docs/design/ratgame_ring_tiering_sheet.md`.

## Scope

In scope:

- Add the 8 exact content-only rings listed below.
- Add `health` as a ring family so Minor Vitality can be authored without folding it into defense.
- Keep all family talent trees empty.

Out of scope:

- Reward weighting, reward rerolls, projectile-only damage, block, stun, slow, timed buffs, next-shot empower, ring-position effects, and other new mechanics.

## Progress

| Ring | Status | Ring ID | Family | Effect | Test Coverage | Notes |
|---|---|---|---|---|---|---|
| Small Damage Band | Done | `RING_GENERIC_DAMAGE_PERCENT_10` | generic | `GLOBAL_HIT_DAMAGE_MORE` more `0.1` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Quick Step | Done | `RING_GENERIC_MOVE_SPEED_10` | generic | `MOVE_SPEED_MORE` more `0.1` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Bruiser's Band | Done | `RING_PHYSICAL_DAMAGE_PERCENT_10` | physical | `PHYSICAL_HIT_DAMAGE_MORE` more `0.1` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Dirty Needle | Done | `RING_POISON_CHANCE_PERCENT_10` | poison | `CHANCE_TO_POISON_ADD` add `0.1` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Small Spark | Done | `RING_IGNITE_CHANCE_PERCENT_10` | ignite | `CHANCE_TO_IGNITE_ADD` add `0.1` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Lucky Scratch | Done | `RING_CRIT_CHANCE_PERCENT_5` | crit | `CRIT_CHANCE_ADD` add `0.05` | `ringContent.test.ts`, catalog smoke | Exact content-only stat modifier. |
| Twitchy Mechanism | Done | `RING_TRIGGER_PROC_CHANCE_PERCENT_10` | trigger | `TRIGGER_PROC_CHANCE_INCREASED` increased `0.1` | `ringContent.test.ts`, catalog smoke | Uses existing trigger proc chance combat rule. |
| Minor Vitality | Done | `RING_HEALTH_MAX_LIFE_ADD_10` | health | `LIFE_ADD` add `10` | `ringContent.test.ts`, catalog smoke | Added `health` family with an empty family tree. |

## Deferred

| Ring | Reason |
|---|---|
| Scatter Shot | Needs projectile-only damage semantics for exact implementation. |
| Sharpened Tip | Needs projectile-hit damage stat key or approximation. |
| Panic Guard | Needs block-charge model. |
| Wider Selection | Needs reward option-count modifier. |
| Selective Hand | Needs reward reroll state and UI action. |
| Curated Rewards | Needs reward weighting by equipped families. |
| Ricochet Rounds | Needs projectile bounce stat support in player weapon firing. |
| All other expansion rings | Need new mechanics, runtime state, or effect primitives outside this content-only batch. |
