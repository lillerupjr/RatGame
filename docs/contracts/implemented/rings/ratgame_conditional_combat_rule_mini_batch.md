# RatGame Conditional Combat-Rule Mini-Batch Contract

Status: Complete / verified

## Goal

Implement the next exact ring expansion batch by adding conditional combat-rule support for no-pierce nearby damage, physical-only build restrictions, and equipped-family scaling.

This contract uses one large implementation section to avoid micro-stopping while preserving the ring-first progression architecture.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Audit recommendation: `docs/design/ratgame_full_ring_pool_audit.md`
- Tiering sheet: `docs/design/ratgame_ring_tiering_sheet.md`
- Current content catalog: `docs/contracts/implemented/ring_v1_content_catalog.md`
- Current backend contract: `docs/contracts/implemented/ring_v1_backend_contract.md`
- Completed projectile contract: `docs/contracts/implemented/rings/ratgame_projectile_ring_stat_expansion.md`

## Locked Scope

Implement exactly:

| Ring | Ring ID | Tier | Family | Exact Effect |
|---|---|---|---|---|
| Close Quarters Guard | `RING_PROJECTILE_CLOSE_QUARTERS_GUARD` | `t2` | projectile | While your projectile has no pierce, hits against enemies within 220px deal 35% increased damage. |
| Pure Force | `RING_PHYSICAL_PURE_FORCE` | `t1` | physical | Your physical hit damage is increased by 30%, but you deal no non-physical hit damage. |
| Physical Devotion | `RING_PHYSICAL_DEVOTION` | `t1` | physical | Deal 20% increased physical hit damage for each equipped physical-family ring, including this ring. |

Required system support:

- Add no-pierce nearby damage combat-rule support.
- Add physical hit damage increased combat-rule support.
- Add non-physical hit damage suppression support.
- Add equipped ring-family count support for combat-rule snapshots.
- Preserve current reward weighting and starter exclusion behavior.

Out of scope:

- Piercing Momentum and per-projectile pierced-hit history.
- Backfire Shot and rear-shot weapon fire modifiers.
- Lightning Chain and chain/multi-target trigger actions.
- Reward manipulation rings.
- Timed buffs, block, stun, slow, neighbor-ring graphs, floor lifecycle hooks, and reward weight tuning.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Conditional combat-rule implementation | Done | Added combat-rule support, authored the three rings, updated docs/tests, and ran verification. |

## Implementation Requirements

- Extend combat-rule type vocabulary with the three generic rule forms needed by this batch.
- Build combat-rule snapshots from runtime effects and equipped ring-family counts.
- Apply no-pierce nearby damage only to non-proc player projectile hits with current pierce count `0`; bounce is not pierce.
- Apply physical hit scaling and non-physical suppression in projectile collision and beam hit paths.
- Apply non-physical suppression to triggered hit damage without reapplying physical scaling.
- Add all three ring definitions to `RING_DEFS_V1` with exact ids, tiers, families, descriptions, tags, and effects.
- Keep family talent trees empty and preserve validation invariants.
- Update current-truth docs and the audit doc to reflect the shipped conditional combat-rule batch.

## Verification

Run:

```sh
npm run typecheck
npm run test -- src/game/progression/effects/combatRules.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
git diff --check
```

Verification completed:

- `npm run typecheck`
- `npm run test -- src/game/progression/effects/combatRules.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts`
- `git diff --check`
