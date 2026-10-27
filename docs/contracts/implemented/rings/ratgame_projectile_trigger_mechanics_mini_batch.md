# RatGame Projectile/Trigger Mechanics Mini-Batch Contract

Status: Complete / verified  
Batch: Phase 2 of non-block ring completion  

## Goal

Implement exactly three projectile/trigger rings and the smallest runtime support needed for their exact authored behavior.

This contract does not add block mechanics, poison/ignite hazards, stun/slow, next-shot empower, slot-position effects, or any other ring content.

## Rings

| Ring | Ring ID | Tier | Runtime Family | Exact Effect |
|---|---|---|---|---|
| Piercing Momentum | `RING_PROJECTILE_PIERCING_MOMENTUM` | `t1` | projectile | Projectiles gain 30% increased damage for each enemy they have pierced. |
| Backfire Shot | `RING_PROJECTILE_BACKFIRE_SHOT` | `t0` | projectile | Also fire a projectile behind you. This projectile is not modified by projectile count. |
| Lightning Chain | `RING_TRIGGER_LIGHTNING_CHAIN` | `t0` | trigger | On hit: 25% chance to chain lightning to up to 3 other targets, dealing 100% of hit damage to each. |

## Implementation Section

| Section | Status | Achievements |
|---|---|---|
| 1. Projectile/trigger mechanics implementation | Done | Added pierce momentum runtime tracking, backfire weapon-fire rules, lightning chain trigger action, three ring definitions, tests, docs, and verification. |

## Locked Behavior

- Add combat rule `PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY` with `increasedPerEnemy: 0.3`.
- Track per-projectile normal pierce consumption in `prPiercedEnemyCount`.
- Apply Piercing Momentum to player-owned non-proc projectile hits before the current hit consumes pierce.
- Increment `prPiercedEnemyCount` only when normal pierce is consumed; bounce hits and poison/free pierce do not count.
- Add passive effect kind `WEAPON_FIRE_RULES` with rule `BACKFIRE_PROJECTILE`.
- Backfire Shot spawns exactly one rear projectile per player projectile firing cycle.
- Backfire projectile clones resolved damage, crit chance, crit multi, ailment chances, pierce, bounce, speed, range, ttl, and weapon hit metadata.
- Backfire projectile is a real weapon hit, not proc damage.
- Backfire projectile is not multiplied by projectile count.
- Beam weapons do not spawn a backfire projectile.
- Add triggered action `CHAIN_HIT`.
- Lightning Chain uses `ON_HIT`, `procChance: 0.25`, `damageScalar: 1`, `damageType: "MATCH_HIT"`, `maxTargets: 3`, `jumpRangePx: 220`.
- Lightning Chain hits up to 3 other nearby alive enemies, excludes the original struck enemy, and avoids duplicate targets in the same chain.
- Lightning Chain direct hits use triggered/proc damage metadata and support existing trigger proc modifiers, double triggers, retry failed procs, chaos conversion, non-physical suppression, and DOT application through Triggered Hits Can Apply DOTs.

## Documentation Targets

- Update shipped/current pool counts to 52 authored rings and 47 normal reward-eligible rings.
- Update active non-block remaining count to 13.
- Preserve non-block target totals at 65 authored and 60 reward-eligible.
- Preserve deferred block reserve at 9.
- Mark Phase 2 done in `docs/design/ratgame_full_ring_pool_audit.md`.
- Set Phase 3 Poison/Ignite Hazard Mini-Batch as next.

## Verification

Run after implementation:

```bash
npm run typecheck
npm run test -- src/game/progression/effects/combatRules.test.ts src/game/progression/effects/triggeredEffects.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts
git diff --check
```

Verified:

- `npm run typecheck`
- `npm run test -- src/game/progression/effects/combatRules.test.ts src/game/progression/effects/triggeredEffects.test.ts src/game/systems/sim/ringCombatRules.test.ts src/game/progression/rings/ringContent.test.ts src/game/progression/rings/ringCatalogSmoke.test.ts src/game/progression/rewards/progressionOffers.test.ts src/game/progression/rewards/progressionRewardFlow.test.ts src/game/vendor/generateVendorProgressionOffers.test.ts`
- `git diff --check`

## Assumptions

- Lightning Chain uses matched hit damage because there is no lightning damage type.
- Lightning Chain hits other targets only; it does not re-hit the original struck target.
- Backfire Shot is treated as player weapon hit damage.
- Piercing Momentum counts only consumed normal pierce, and the current hit does not count itself.
