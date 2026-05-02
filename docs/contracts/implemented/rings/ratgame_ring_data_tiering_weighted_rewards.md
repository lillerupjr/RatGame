# RatGame Ring Data Tiering + Weighted Rewards Contract

Status: Complete / verified; ready to move to implemented

## Goal

Convert authored ring tier data from the temporary `tier: 1` lock to exact authored tier strings, then use those tiers for normal ring reward weighting.

This contract deliberately does not add more rings. It stabilizes the current ring data shape first, so later full-pool expansion can reuse the same authored tier field and reward selection path.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Roadmap: `docs/design/ratgame_ring_reward_roadmap.md`
- Tier source of truth: `docs/design/ratgame_ring_tiering_sheet.md`
- Current content-only implementation record: `docs/contracts/implemented/rings/ratgame_ring_content_only_implementation.md`

## Locked Scope

- Add authored ring tiers as exact strings: `t0`, `t1`, `t2`, `t3`.
- Preserve runtime compatibility: ring instances still store `defId`, reward option ids remain `RING:<defId>`, and starter ring equip still resolves through `getRingDefById(...)`.
- Exclude starter-family rings from normal generated ring rewards.
- Add tier-weighted ring reward generation over the non-starter ring pool.
- Surface minimal reward-tier debug data through typed reward options and reward option views.
- Update current-truth docs that still describe `tier: 1`.

Out of scope:

- Adding more rings.
- Reward rerolls.
- Family-curated rewards.
- Token reward expansion.
- Block, stun, slow, timed buff, or next-shot empower systems.
- Full-run rarity tuning beyond the first roadmap weights.

## Tier Assignments

Use the tiering sheet as the source of truth for current authored content.

| Tier | Ring IDs |
|---|---|
| `t0` | `RING_TRIGGER_BAZOOKA_ON_HIT`, `RING_TRIGGER_DOUBLE_TRIGGERS` |
| `t1` | `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50`, `RING_PROJECTILE_ADDITIONAL_PROJECTILES_1`, `RING_DOT_SPECIALIST`, `RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS`, `RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS`, `RING_IGNITE_SPREAD_ON_DEATH`, `RING_IGNITE_CRITS_APPLY_IGNITE`, `RING_CRIT_ROLLS_TWICE`, `RING_TRIGGER_EXPLODE_ON_KILL`, `RING_TRIGGER_PROC_CHANCE_PERCENT_50`, `RING_TRIGGER_RETRY_FAILED_PROCS_ONCE` |
| `t2` | `RING_STARTER_STREET_REFLEX`, `RING_STARTER_LUCKY_CHAMBER`, `RING_STARTER_CONTAMINATED_ROUNDS`, `RING_STARTER_POINT_BLANK_CARNAGE`, `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30`, `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30`, `RING_PROJECTILE_GAIN_PIERCE_1`, `RING_DOT_DAMAGE_OVER_TIME_MORE_50`, `RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25`, `RING_TRIGGER_SPARK_ON_HIT`, `RING_TRIGGER_DAGGER_ON_KILL` |
| `t3` | `RING_STARTER_THERMAL_STARTER`, `RING_GENERIC_DAMAGE_PERCENT_20`, `RING_GENERIC_DAMAGE_PERCENT_10`, `RING_GENERIC_MOVE_SPEED_20`, `RING_GENERIC_MOVE_SPEED_10`, `RING_PHYSICAL_DAMAGE_PERCENT_20`, `RING_PHYSICAL_DAMAGE_PERCENT_10`, `RING_POISON_CHANCE_PERCENT_25`, `RING_POISON_CHANCE_PERCENT_10`, `RING_IGNITE_CHANCE_PERCENT_10`, `RING_CRIT_CHANCE_PERCENT_5`, `RING_TRIGGER_PROC_CHANCE_PERCENT_10`, `RING_HEALTH_MAX_LIFE_ADD_10` |

## Reward Weighting

Normal ring rewards roll tiers using tunable shown-ring weights:

| Tier | Weight |
|---|---:|
| `t0` | `0.01` |
| `t1` | `0.05` |
| `t2` | `0.25` |
| `t3` | `0.69` |

The implementation must normalize these weights before rolling, so future tuning does not depend on an exact sum of `1`.

For each generated ring option:

1. Roll one tier from the normalized weights.
2. Pick one remaining non-starter ring from that tier.
3. If the rolled tier is empty or exhausted, pick uniformly from the full remaining non-starter pool.
4. Do not produce duplicate ring ids within one offer list.
5. Store both `rolledTier` and `authoredTier` on the ring reward option.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Contract setup | Done | Created this contract, read it end-to-end, and confirmed the locked scope. |
| 2. Tier data conversion | Done | Added `RingTier`, converted current ring definitions, and updated validation/tests for authored tiers. |
| 3. Weighted rewards | Done | Replaced uniform ring reward generation with tier-weighted non-starter selection and minimal tier debug data. |
| 4. Documentation updates | Done | Updated canonical/current-truth docs and roadmap status for completed tiering and weighting work. |
| 5. Verification | Done | Ran typecheck and targeted tests listed below. |

## Test Plan

- `src/game/progression/rings/ringContent.test.ts`
  - Assert exact tier for every current ring id.
  - Assert `validateRingContent(...)` accepts all valid tier strings.
  - Assert invalid tier values are rejected.
- `src/game/progression/rewards/progressionOffers.test.ts`
  - Assert normal ring rewards exclude starter rings.
  - Assert ring reward options contain no duplicate ring ids.
  - Assert ring reward options expose `authoredTier` and `rolledTier`.
  - Assert deterministic tier-roll boundaries for `t0`, `t1`, `t2`, and `t3`.
  - Assert fallback behavior when a rolled tier is unavailable or exhausted.
- Existing catalog smoke coverage remains responsible for verifying every authored ring surfaces through runtime inspection and effect collection.

Run:

```sh
npm run typecheck
npm run test -- src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
```

## Completion Notes

- Starter rings receive authored tiers for inspection and future tuning, but normal generated ring rewards exclude them.
- This contract can move from draft to implemented only after all sections above are complete and verified.
