# RatGame Health/Floor Lifecycle Mini-Batch Contract

Status: Complete / verified

## Goal

Implement the next exact ring expansion batch by adding health-scaling damage and floor-complete healing support.

This contract uses one large implementation section to avoid micro-stopping while preserving the ring-first progression architecture.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Audit recommendation: `docs/design/ratgame_full_ring_pool_audit.md`
- Tiering sheet: `docs/design/ratgame_ring_tiering_sheet.md`
- Current reward roadmap: `docs/design/ratgame_ring_reward_roadmap.md`
- Current content catalog: `docs/contracts/implemented/ring_v1_content_catalog.md`
- Current backend contract: `docs/contracts/implemented/ring_v1_backend_contract.md`
- Completed conditional combat-rule contract: `docs/contracts/implemented/rings/ratgame_conditional_combat_rule_mini_batch.md`

## Locked Scope

Implement exactly:

| Ring | Ring ID | Tier | Family | Exact Effect |
|---|---|---|---|---|
| Floor Recovery | `RING_HEALTH_FLOOR_RECOVERY` | `t3` | health | Heal 10 health after completing a floor. |
| Vital Force | `RING_HEALTH_VITAL_FORCE` | `t1` | health | Deal increased damage equal to 20% of your maximum health. |
| Wounded Fury | `RING_HEALTH_WOUNDED_FURY` | `t2` | health | Deal 5% increased damage for each 10 health missing. |

Required system support:

- Add a floor lifecycle runtime effect for floor-complete healing.
- Add dynamic stat modifier runtime support for max-life and missing-life damage scaling.
- Apply floor-complete healing only when a floor clear is committed.
- Preserve current reward weighting and starter exclusion behavior.

Out of scope:

- Additional health rings beyond the three locked rings.
- Regeneration, leech, shield, armor, block, stun, slow, or timed buff mechanics.
- Reward manipulation rings.
- Reward tuning or full-run frequency checks.
- Any new non-ring progression family.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Health/floor lifecycle implementation | Done | Added floor lifecycle effects, dynamic health-scaling stat mods, authored the three rings, updated docs/tests, and ran verification. |

## Implementation Requirements

- Extend effect type vocabulary with `FLOOR_LIFECYCLE` and `DYNAMIC_STAT_MODIFIERS`.
- Validate the new authored effect kinds in ring content validation.
- Generate dynamic global hit damage increased stat mods from runtime ring effects:
  - Vital Force: `0.002` increased global hit damage per maximum life, so 100 max life grants 20% increased damage.
  - Wounded Fury: `0.05` increased global hit damage per full 10 missing health.
- Add a floor lifecycle helper under `src/game/progression/effects/`.
- Hook floor-complete effects into the existing committed floor-clear path.
- Add all three ring definitions to `RING_DEFS_V1` with exact ids, tiers, families, descriptions, tags, and effects.
- Keep family talent trees empty and preserve validation invariants.
- Update current-truth docs and the audit doc to reflect the shipped health/floor lifecycle batch.

## Verification

Run:

```sh
npm run typecheck
npm run test -- src/game/progression/effects/worldEffects.test.ts src/game/progression/effects/floorLifecycleEffects.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
git diff --check
```

Verification completed:

- `npm run typecheck`
- `npm run test -- src/game/progression/effects/worldEffects.test.ts src/game/progression/effects/floorLifecycleEffects.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts`
- `git diff --check`
