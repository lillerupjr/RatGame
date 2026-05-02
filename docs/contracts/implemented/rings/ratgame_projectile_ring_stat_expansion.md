# RatGame Projectile Ring Stat Expansion Contract

Status: Complete / verified

## Goal

Implement the next exact ring expansion batch by adding projectile-only damage and authored projectile bounce support, then ship three projectile rings:

- Sharpened Tip
- Ricochet Rounds
- Scatter Shot

This contract uses one large implementation section to avoid micro-stopping. It must still preserve the ring-first progression architecture and avoid approximation rings.

## Source Inputs

- Architecture rules: `docs/AGENTS.md`
- Audit recommendation: `docs/design/ratgame_full_ring_pool_audit.md`
- Tiering sheet: `docs/design/ratgame_ring_tiering_sheet.md`
- Current content catalog: `docs/contracts/implemented/ring_v1_content_catalog.md`
- Current backend contract: `docs/contracts/implemented/ring_v1_backend_contract.md`
- Completed audit contract: `docs/contracts/implemented/rings/ratgame_full_ring_pool_audit_expansion_plan.md`

## Locked Scope

Implement exactly:

| Ring | Ring ID | Tier | Family | Exact Effect |
|---|---|---|---|---|
| Sharpened Tip | `RING_PROJECTILE_DAMAGE_INCREASED_10` | `t3` | projectile | Projectiles deal 10% increased damage. |
| Ricochet Rounds | `RING_PROJECTILE_BOUNCE_ADD_1` | `t1` | projectile | Projectiles gain +1 bounce. |
| Scatter Shot | `RING_PROJECTILE_SCATTER_SHOT` | `t0` | projectile | Gain +5 projectiles, but projectiles deal 75% less damage. |

Required system support:

- Add projectile-only hit damage stat support, separate from global hit damage.
- Add authored projectile bounce stat support and apply it to player weapon projectiles.
- Preserve current reward weighting and starter exclusion behavior.
- Keep all effects exact; do not approximate projectile-only damage with global hit damage.

Out of scope:

- Piercing Momentum and per-projectile pierced-hit history.
- Backfire Shot and rear-shot weapon fire modifiers.
- Lightning Chain and chain/multi-target trigger actions.
- Reward manipulation rings.
- Timed buffs, block, stun, slow, neighbor-ring graphs, and floor lifecycle hooks.
- Reward weight tuning.

## Section Progress

| Section | Status | Achievement |
|---|---|---|
| 1. Projectile stat expansion implementation | Done | Added projectile-only damage and bounce support, authored the three rings, updated docs/tests, and ran verification. |

## Implementation Requirements

- Extend stat key vocabulary for projectile-only hit damage and projectile bounce.
- Wire projectile-only damage into stat resolution so it affects projectile weapon hit damage without affecting non-projectile/global hit damage.
- Wire projectile bounce into the player weapon projectile spawn path using derived/resolved weapon stats.
- Add all three ring definitions to `RING_DEFS_V1` with the exact ids, tiers, family, descriptions, tags, and effects from this contract.
- Keep family talent trees empty and preserve validation invariants.
- Update tests for:
  - stat resolver projectile-only damage and bounce output,
  - ring content ids/tiers/effects,
  - ring catalog smoke coverage,
  - reward generation still producing typed tiered ring options.
- Update current-truth docs and the audit doc to reflect the shipped projectile batch.

## Verification

Run:

```sh
npm run typecheck
npm run test -- src/game/combat_mods/stats/combatStatsResolver.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
git diff --check
```

If projectile spawn behavior gets a more specific existing test file during implementation, include it in the verification set.

Verification completed:

- `npm run typecheck`
- `npm run test -- src/game/combat_mods/stats/combatStatsResolver.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts`
- `git diff --check`
