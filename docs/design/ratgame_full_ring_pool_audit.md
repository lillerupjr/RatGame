# RatGame Full Ring Pool Audit

Status: Complete / verified  
Contract: `docs/contracts/implemented/rings/ratgame_full_ring_pool_audit_expansion_plan.md`

## Purpose

Track the full-ring-pool planning pass before adding more ring content.

This document records the shipped pool audit, target pool, readiness classification, and implementation batch sequence.

## Current Shipped Pool Audit

Source truth:

- Ring definitions: `src/game/progression/rings/ringContent.ts`
- Reward eligibility: `src/game/progression/rewards/progressionOffers.ts`
- Current tier model: `t0`, `t1`, `t2`, `t3`

Summary:

| Metric | Count | Notes |
|---|---:|---|
| Total shipped authored rings | 65 | All entries in `RING_DEFS_V1`. |
| Starter-only rings | 5 | `familyId: "starter"`; installed by starter loadout. |
| Normal reward-eligible rings | 60 | Generated ring rewards filter out starter-family rings. |
| Empty authored families | 1 | `defense` has a family tree but no rings yet. |

No source/doc conflict was found for the active current pool count. The roadmap's older "current 29 rings" language is now superseded by the 57-ring source audit.

## Tier Distribution

All shipped rings:

| Tier | Count |
|---|---:|
| `t0` | 10 |
| `t1` | 20 |
| `t2` | 18 |
| `t3` | 17 |

Normal reward-eligible rings only:

| Tier | Count |
|---|---:|
| `t0` | 10 |
| `t1` | 20 |
| `t2` | 14 |
| `t3` | 16 |

Starter rings account for four `t2` rings and one `t3` ring, but do not appear in normal generated ring rewards.

## Family Distribution

All shipped rings:

| Family | Count |
|---|---:|
| starter | 5 |
| generic | 8 |
| physical | 7 |
| projectile | 8 |
| dot | 3 |
| chaos | 1 |
| poison | 6 |
| ignite | 5 |
| crit | 3 |
| trigger | 9 |
| health | 4 |
| defense | 0 |
| utility | 3 |

Normal reward-eligible rings only:

| Family | Count |
|---|---:|
| generic | 8 |
| physical | 7 |
| projectile | 8 |
| dot | 3 |
| chaos | 1 |
| poison | 6 |
| ignite | 5 |
| crit | 3 |
| trigger | 9 |
| health | 4 |
| defense | 0 |
| utility | 3 |

## Shipped Ring List

| Ring | Ring ID | Family | Tier | Reward Eligible |
|---|---|---|---|---|
| Street Reflex | `RING_STARTER_STREET_REFLEX` | starter | `t2` | No |
| Lucky Chamber | `RING_STARTER_LUCKY_CHAMBER` | starter | `t2` | No |
| Contaminated Rounds | `RING_STARTER_CONTAMINATED_ROUNDS` | starter | `t2` | No |
| Point Blank Carnage | `RING_STARTER_POINT_BLANK_CARNAGE` | starter | `t2` | No |
| Thermal Starter | `RING_STARTER_THERMAL_STARTER` | starter | `t3` | No |
| 20% More Damage | `RING_GENERIC_DAMAGE_PERCENT_20` | generic | `t3` | Yes |
| Small Damage Band | `RING_GENERIC_DAMAGE_PERCENT_10` | generic | `t3` | Yes |
| 60% More Damage / 30% Less Attack Speed | `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30` | generic | `t2` | Yes |
| 60% More Attack Speed / 30% Less Damage | `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30` | generic | `t2` | Yes |
| 100% More Damage / 50% Less Maximum Life | `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50` | generic | `t1` | Yes |
| 20% More Movement Speed | `RING_GENERIC_MOVE_SPEED_20` | generic | `t3` | Yes |
| Quick Step | `RING_GENERIC_MOVE_SPEED_10` | generic | `t3` | Yes |
| 20% More Physical Damage | `RING_PHYSICAL_DAMAGE_PERCENT_20` | physical | `t3` | Yes |
| Bruiser's Band | `RING_PHYSICAL_DAMAGE_PERCENT_10` | physical | `t3` | Yes |
| Pure Force | `RING_PHYSICAL_PURE_FORCE` | physical | `t1` | Yes |
| Physical Devotion | `RING_PHYSICAL_DEVOTION` | physical | `t1` | Yes |
| +1 Projectile | `RING_PROJECTILE_ADDITIONAL_PROJECTILES_1` | projectile | `t1` | Yes |
| +1 Pierce | `RING_PROJECTILE_GAIN_PIERCE_1` | projectile | `t2` | Yes |
| Piercing Momentum | `RING_PROJECTILE_PIERCING_MOMENTUM` | projectile | `t1` | Yes |
| Sharpened Tip | `RING_PROJECTILE_DAMAGE_INCREASED_10` | projectile | `t3` | Yes |
| Ricochet Rounds | `RING_PROJECTILE_BOUNCE_ADD_1` | projectile | `t1` | Yes |
| Scatter Shot | `RING_PROJECTILE_SCATTER_SHOT` | projectile | `t0` | Yes |
| Backfire Shot | `RING_PROJECTILE_BACKFIRE_SHOT` | projectile | `t0` | Yes |
| Close Quarters Guard | `RING_PROJECTILE_CLOSE_QUARTERS_GUARD` | projectile | `t2` | Yes |
| 50% More Damage Over Time | `RING_DOT_DAMAGE_OVER_TIME_MORE_50` | dot | `t2` | Yes |
| DOT Specialist | `RING_DOT_SPECIALIST` | dot | `t1` | Yes |
| Triggered Hits Can Apply DOTs | `RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS` | dot | `t1` | Yes |
| All Hit Damage Converted to Chaos | `RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS` | chaos | `t1` | Yes |
| +25% Poison Chance | `RING_POISON_CHANCE_PERCENT_25` | poison | `t3` | Yes |
| Dirty Needle | `RING_POISON_CHANCE_PERCENT_10` | poison | `t3` | Yes |
| Poisons Can Add an Extra Stack | `RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25` | poison | `t2` | Yes |
| Ignite Spreads on Death | `RING_IGNITE_SPREAD_ON_DEATH` | ignite | `t1` | Yes |
| Crits Apply Ignite | `RING_IGNITE_CRITS_APPLY_IGNITE` | ignite | `t1` | Yes |
| Small Spark | `RING_IGNITE_CHANCE_PERCENT_10` | ignite | `t3` | Yes |
| Crit Rolls Twice | `RING_CRIT_ROLLS_TWICE` | crit | `t1` | Yes |
| Lucky Scratch | `RING_CRIT_CHANCE_PERCENT_5` | crit | `t3` | Yes |
| Bazooka on Hit | `RING_TRIGGER_BAZOOKA_ON_HIT` | trigger | `t0` | Yes |
| Lightning Chain | `RING_TRIGGER_LIGHTNING_CHAIN` | trigger | `t0` | Yes |
| Spark on Hit | `RING_TRIGGER_SPARK_ON_HIT` | trigger | `t2` | Yes |
| Explode on Kill | `RING_TRIGGER_EXPLODE_ON_KILL` | trigger | `t1` | Yes |
| Dagger on Kill | `RING_TRIGGER_DAGGER_ON_KILL` | trigger | `t2` | Yes |
| Double Triggers | `RING_TRIGGER_DOUBLE_TRIGGERS` | trigger | `t0` | Yes |
| +50% Trigger Proc Chance | `RING_TRIGGER_PROC_CHANCE_PERCENT_50` | trigger | `t1` | Yes |
| Twitchy Mechanism | `RING_TRIGGER_PROC_CHANCE_PERCENT_10` | trigger | `t3` | Yes |
| Retry Failed Procs Once | `RING_TRIGGER_RETRY_FAILED_PROCS_ONCE` | trigger | `t1` | Yes |
| Minor Vitality | `RING_HEALTH_MAX_LIFE_ADD_10` | health | `t3` | Yes |
| Floor Recovery | `RING_HEALTH_FLOOR_RECOVERY` | health | `t3` | Yes |
| Vital Force | `RING_HEALTH_VITAL_FORCE` | health | `t1` | Yes |
| Wounded Fury | `RING_HEALTH_WOUNDED_FURY` | health | `t2` | Yes |
| Wider Selection | `RING_UTILITY_WIDER_SELECTION` | utility | `t1` | Yes |
| Curated Rewards | `RING_UTILITY_CURATED_REWARDS` | utility | `t1` | Yes |
| Selective Hand | `RING_UTILITY_SELECTIVE_HAND` | utility | `t1` | Yes |
| Poison Trail | `RING_POISON_POISON_TRAIL` | poison | `t2` | Yes |
| Laser Executor | `RING_IGNITE_LASER_EXECUTOR` | ignite | `t1` | Yes |
| Plague Detonation | `RING_POISON_PLAGUE_DETONATION` | poison | `t0` | Yes |
| Smoldering Drag | `RING_IGNITE_SMOLDERING_DRAG` | ignite | `t3` | Yes |
| Weakening Venom | `RING_POISON_WEAKENING_VENOM` | poison | `t2` | Yes |
| Retaliation Burst | `RING_PHYSICAL_RETALIATION_BURST` | physical | `t2` | Yes |
| Staggering Blows | `RING_PHYSICAL_STAGGERING_BLOWS` | physical | `t3` | Yes |
| Heavy Chamber | `RING_PHYSICAL_HEAVY_CHAMBER` | physical | `t2` | Yes |
| Kill Momentum | `RING_GENERIC_KILL_MOMENTUM` | generic | `t2` | Yes |
| Critical Sprint | `RING_CRIT_CRITICAL_SPRINT` | crit | `t0` | Yes |

## Target List

Target source:

- Include all shipped rings from `RING_DEFS_V1`.
- Include unshipped candidates from `New Locked Rings`.
- Include unshipped candidates from `New Tentative Rings`.
- Exclude block-dependent rings from the next V1/V2 target pool.
- Exclude future starter upgrades from the normal ring-pool target.

Planning note: the current non-block completion push also defers Panic Guard because its exact effect grants block. It is grouped with the block reserve until a block-charge model is intentionally implemented.

Target pool size:

| Pool Segment | Count | Notes |
|---|---:|---|
| Shipped authored rings | 62 | Includes 5 starter-only rings and 57 normal reward-eligible rings. |
| Unshipped non-block target candidates | 3 | New Locked plus unshipped New Tentative candidates, excluding block-dependent rings and the Phase 3–4 rings now shipped. |
| Non-block target authored ring total | 65 | Current shipped rings plus all active non-block candidates. |
| Non-block target normal reward-eligible total | 60 | Total non-block target minus 5 starter-only rings. |
| Deferred block reserve | 9 | Panic Guard plus the tiering sheet block group. |

The final target list for this completion pass is therefore the current 62 shipped rings plus the 3 non-block candidates below.

### Included Unshipped Candidates

| Ring | Design Family | Tier | Source Section | Target Status |
|---|---|---|---|---|
| Poison Trail | poison | `t2` | New Locked Rings | Include |
| Laser Executor | fire | `t1` | New Locked Rings | Include |
| Retaliation Burst | physical | `t2` | New Locked Rings | Include |
| Staggering Blows | physical | `t3` | New Locked Rings | Include |
| Mirror Band | other | `t0` | New Locked Rings | Include |
| Amplifying Band | other | `t0` | New Locked Rings | Include |
| Smoldering Drag | ignite | `t3` | New Tentative Rings | Include |
| Weakening Venom | poison | `t2` | New Tentative Rings | Include |
| Heavy Chamber | physical | `t2` | New Tentative Rings | Include |
| Kill Momentum | generic | `t2` | New Tentative Rings | Include |
| Plague Detonation | poison / chaos | `t0` | New Tentative Rings | Include |
| Critical Sprint | crit | `t0` | New Tentative Rings | Include |
| Living Bomb | fire | `t0` | New Tentative Rings | Include |

### Already Shipped From Tentative Candidates

These candidates already moved from the tiering sheet into `RING_DEFS_V1` during completed implementation batches:

- Small Damage Band
- Quick Step
- Bruiser's Band
- Dirty Needle
- Small Spark
- Lucky Scratch
- Twitchy Mechanism
- Minor Vitality
- Sharpened Tip
- Ricochet Rounds
- Scatter Shot
- Close Quarters Guard
- Pure Force
- Physical Devotion
- Floor Recovery
- Vital Force
- Wounded Fury
- Wider Selection
- Curated Rewards
- Selective Hand
- Piercing Momentum
- Backfire Shot
- Lightning Chain
- Poison Trail
- Laser Executor
- Plague Detonation
- Smoldering Drag
- Weakening Venom
- Retaliation Burst
- Staggering Blows
- Heavy Chamber
- Kill Momentum
- Critical Sprint

### Deferred Block Reserve Candidates

The block group remains outside this target pool until a block-charge system exists:

| Ring | Design Family | Tier | Reason |
|---|---|---|---|
| Panic Guard | defense | `t2` | Exact behavior grants block once per floor; deferred with block system. |
| Glass Aegis | defense | `t2` | Block system deferred. |
| Reprisal Barrier | defense / trigger | `t2` | Block system deferred. |
| Block Renewal | defense | `t3` | Block system deferred. |
| Extra Guard | defense | `t2` | Block system deferred. |
| Guarded Momentum | defense / movement | `t3` | Block system deferred. |
| Counterguard | defense / trigger | `t2` | Block and next-shot empower systems deferred. |
| Deflecting Tradeoff | defense / projectile | `t2` | Block system deferred. |
| Guarded Ammunition | defense / projectile | `t2` | Block and post-pierce conditional damage systems deferred. |

Family naming note: this target list preserves design-family labels from the tiering sheet. Runtime family mapping and any required family-id cleanup belong to the readiness classification and follow-up implementation contracts.

## Readiness Classification

Classification rule: exact implementation only. If a ring can only be approximated with current primitives, it is classified by the smallest upgrade needed for the exact behavior.

Summary:

| Classification | Count | Notes |
|---|---:|---|
| Already shipped | 62 | Current `RING_DEFS_V1`; includes the content-only, projectile stat expansion, conditional combat-rule, health/floor lifecycle, reward manipulation, projectile/trigger mechanics, poison/ignite hazard, and physical control/empower batches. |
| Ready with current systems | 0 | No unshipped target candidate remains exact content-only. |
| Ready after small system upgrade | 0 | All small-upgrade candidates are now shipped. |
| Needs larger new system | 3 | Needs new runtime state, status/effect framework, periodic scanner, graph behavior, or significant presentation/runtime loop. |
| Intentionally deferred reserve | 9 | Block-dependent rings outside the non-block completion pool. |

### Already Shipped

All 62 current `RING_DEFS_V1` entries are already implemented and validated. The previously "ready with current systems" filler/enabler set and all small-upgrade batches are now shipped:

- Small Damage Band
- Quick Step
- Bruiser's Band
- Dirty Needle
- Small Spark
- Lucky Scratch
- Twitchy Mechanism
- Minor Vitality
- Sharpened Tip
- Ricochet Rounds
- Scatter Shot
- Close Quarters Guard
- Pure Force
- Physical Devotion
- Floor Recovery
- Vital Force
- Wounded Fury
- Wider Selection
- Curated Rewards
- Selective Hand
- Piercing Momentum
- Backfire Shot
- Lightning Chain
- Poison Trail
- Laser Executor
- Plague Detonation
- Smoldering Drag
- Weakening Venom
- Retaliation Burst
- Staggering Blows
- Heavy Chamber
- Kill Momentum
- Critical Sprint

### Ready With Current Systems

No unshipped target candidates are exact content-only under current systems.

### Ready After Small System Upgrade

All small-upgrade candidates are now shipped.

### Needs Larger New System

All candidates in this category have been shipped (Phases 5 & 6).

| Ring | Needed System | Status |
|---|---|---|
| Mirror Band | Neighbor-ring effect graph. | Done (Phase 5) |
| Amplifying Band | Neighbor-ring effect scaling graph. | Done (Phase 5) |
| Living Bomb | Timed mark, enemy speed buff, and death explosion link. | Done (Phase 6) |

### Deferred Block Reserve

The 9 block-dependent rings stay outside the non-block completion pool until the full block-charge model exists:

- Panic Guard
- Glass Aegis
- Reprisal Barrier
- Block Renewal
- Extra Guard
- Guarded Momentum
- Counterguard
- Deflecting Tradeoff
- Guarded Ammunition

### Family Mapping Notes

Some design-family labels do not map directly to current runtime families and must be resolved in implementation contracts:

| Design Label | Recommended Runtime Handling |
|---|---|
| fire | Use `ignite` unless a broader fire family is introduced intentionally. |
| trigger / lightning | Use `trigger`; keep lightning as a tag/effect flavor unless a lightning family is introduced. |
| other | Use `utility` for reward-manipulation and slot-position rings unless a new family is justified. |
| family / physical | Use `physical`; encode family-count behavior in the effect/rule, not the family id. |
| defense / projectile | Choose the primary runtime family per implementation contract; use tags for the secondary identity. |
| poison / chaos | Choose the primary runtime family per implementation contract; use tags for the secondary identity. |

## Completed Projectile Batch

Completed code-bearing contract:

`docs/contracts/implemented/rings/ratgame_projectile_ring_stat_expansion.md`

Implemented batch: **Projectile Stat Expansion**.

This batch shipped exactly these 3 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Sharpened Tip | `t3` | projectile | Projectiles deal 10% increased damage. |
| Ricochet Rounds | `t1` | projectile | Projectiles gain +1 bounce. |
| Scatter Shot | `t0` | projectile | Gain +5 projectiles, but projectiles deal 75% less damage. |

Implemented support:

- Added projectile-only hit damage stat support, separate from global hit damage.
- Added authored projectile bounce stat support, wired through player weapon projectile spawn/runtime.
- Added the 3 ring definitions above to `RING_DEFS_V1`.
- Preserved current reward weighting and starter exclusion behavior.
- Added targeted stat/resolver/runtime tests plus ring content and catalog smoke coverage.

## Completed Conditional Combat-Rule Batch

Completed code-bearing contract:

`docs/contracts/implemented/rings/ratgame_conditional_combat_rule_mini_batch.md`

Implemented batch: **Conditional Combat-Rule Mini-Batch**.

This batch shipped exactly these 3 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Close Quarters Guard | `t2` | projectile | While your projectile has no pierce, hits against enemies within 220px deal 35% increased damage. |
| Pure Force | `t1` | physical | Your physical hit damage is increased by 30%, but you deal no non-physical hit damage. |
| Physical Devotion | `t1` | physical | Deal 20% increased physical hit damage for each equipped physical-family ring. |

Implemented support:

- Added no-pierce nearby damage combat-rule support.
- Added physical hit damage scaling and non-physical hit damage suppression.
- Added equipped ring-family count support for family-scaling combat rules.
- Preserved current reward weighting and starter exclusion behavior.
- Added targeted combat-rule snapshot/runtime tests plus ring content and catalog smoke coverage.

## Completed Health/Floor Lifecycle Batch

Completed code-bearing contract:

`docs/contracts/implemented/rings/ratgame_health_floor_lifecycle_mini_batch.md`

Implemented batch: **Health/Floor Lifecycle Mini-Batch**.

This batch shipped exactly these 3 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Floor Recovery | `t3` | health | Heal 10 health after completing a floor. |
| Vital Force | `t1` | health | Deal increased damage equal to 20% of maximum health. |
| Wounded Fury | `t2` | health | Deal 5% increased damage for each 10 health missing. |

Implemented support:

- Added floor-complete lifecycle effects for ring-owned healing.
- Added dynamic stat modifiers for max-life and missing-life damage scaling.
- Hooked floor lifecycle effects into the committed floor-clear path.
- Preserved current reward weighting and starter exclusion behavior.
- Added targeted dynamic stat/floor lifecycle tests plus ring content and catalog smoke coverage.

## Completed Reward Manipulation Batch

Completed code-bearing contract:

`docs/contracts/implemented/rings/ratgame_reward_manipulation_mini_batch.md`

Implemented batch: **Reward Manipulation Mini-Batch**.

This batch shipped exactly these 3 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Wider Selection | `t1` | utility | Ring rewards offer +1 additional option. |
| Curated Rewards | `t1` | utility | Ring rewards are slightly more likely to contain a family you already have equipped. |
| Selective Hand | `t1` | utility | After each floor, you may reroll ring rewards once. |

Implemented support:

- Added reward-rule runtime effects for ring reward option count, equipped-family selection bias, and floor-completion ring reward rerolls.
- Kept vendor inventory generation on the base reward generator.
- Added a one-use reward overlay reroll button for eligible floor-completion ring rewards.
- Added targeted reward generation/flow tests plus ring content and catalog smoke coverage.

## Completed Projectile/Trigger Mechanics Batch

Completed code-bearing contract:

`docs/contracts/implemented/rings/ratgame_projectile_trigger_mechanics_mini_batch.md`

Implemented batch: **Projectile/Trigger Mechanics Mini-Batch**.

This batch shipped exactly these 3 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Piercing Momentum | `t1` | projectile | Projectiles gain 30% increased damage for each enemy they have pierced. |
| Backfire Shot | `t0` | projectile | Also fire a projectile behind you. This projectile is not modified by projectile count. |
| Lightning Chain | `t0` | trigger | On hit: 25% chance to chain lightning to up to 3 other targets, dealing 100% of hit damage to each. |

Implemented support:

- Added per-projectile normal-pierce tracking for pierce momentum damage scaling.
- Added weapon-fire runtime effects for one rear projectile per projectile firing cycle.
- Added direct chain-hit triggered actions for bounded multi-target trigger damage.
- Added targeted combat-rule, trigger, runtime, ring content, catalog, reward, and vendor coverage.

## Completed Poison/Ignite Hazard Batch

Implemented batch: **Poison/Ignite Hazard Mini-Batch**.

This batch shipped exactly these 5 rings:

| Ring | Tier | Runtime Family | Exact Effect |
|---|---|---|---|
| Poison Trail | `t2` | poison | Leave a poison trail behind you that poisons enemies. |
| Laser Executor | `t1` | ignite | Periodically execute nearby enemies below 15% life. |
| Plague Detonation | `t0` | poison | Poisoned enemies explode on death for 50% of their max life as chaos damage. |
| Smoldering Drag | `t3` | ignite | Ignited enemies are slowed by 10%. |
| Weakening Venom | `t2` | poison | Poisoned enemies deal 20% less damage. |

Implemented support:

- Added 5 new combat rule types: POISON_TRAIL, LASER_EXECUTOR, POISONED_ENEMIES_EXPLODE_ON_DEATH, BURNING_ENEMIES_MOVE_SPEED_REDUCED, POISONED_ENEMIES_DAMAGE_REDUCED.
- Added poison trail zone spawner with periodic drop and poison-stack application.
- Added laser executor periodic scan-and-execute for low-life enemies.
- Added burning enemy movement slow in movement system.
- Added poisoned enemy contact damage reduction in collisions system.
- Added poisoned enemy death explosion in finalize system.
- Added ZONE_KIND.POISON for poison trail zones.
- Added targeted combat-rule snapshot, poison trail, laser executor, ring content, and catalog smoke coverage.

## Non-Block Completion Phased Plan

Goal: finish every non-block ring in the active target pool before returning to block mechanics.

Scope:

- Implement the 8 remaining unshipped non-block target candidates.
- Keep the 9 block-dependent rings deferred: Panic Guard plus the 8 block reserve rings.
- Create one code-bearing contract per batch under `docs/contracts/draft/rings/`.
- Implement and verify one batch at a time, then move the contract to `docs/contracts/implemented/rings/`.

Progress summary:

| Phase | Batch | Ring Count | Status | Contract |
|---:|---|---:|---|---|
| 1 | Reward Manipulation Mini-Batch | 3 | Done | `docs/contracts/implemented/rings/ratgame_reward_manipulation_mini_batch.md` |
| 2 | Projectile/Trigger Mechanics Mini-Batch | 3 | Done | `docs/contracts/implemented/rings/ratgame_projectile_trigger_mechanics_mini_batch.md` |
| 3 | Poison/Ignite Hazard Mini-Batch | 5 | Done | `docs/contracts/implemented/rings/ratgame_poison_ignite_hazard_mini_batch.md` |
| 4 | Physical Control/Empower Mini-Batch | 5 | Done | — |
| 5 | Slot Position Chase Mini-Batch | 2 | Done | — |
| 6 | Living Bomb Setpiece Mini-Batch | 1 | Done | — |

### Phase 1: Reward Manipulation Mini-Batch

Implement exactly these 3 rings:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Wider Selection | `RING_UTILITY_WIDER_SELECTION` | `t1` | utility | Ring rewards offer +1 additional option. | Add ring-owned reward option-count modifier. |
| Curated Rewards | `RING_UTILITY_CURATED_REWARDS` | `t1` | utility | Ring rewards are slightly more likely to contain a family you already have equipped. | Add equipped-family-biased reward weighting. |
| Selective Hand | `RING_UTILITY_SELECTIVE_HAND` | `t1` | utility | After each floor, you may reroll ring rewards once. | Add reward reroll state and UI action. |

Why this comes first:

- It strengthens the reward loop before the remaining high-complexity combat systems.
- It reuses centralized reward generation and typed progression options.
- It should make later larger-ring batches easier to inspect during play.

### Phase 2: Projectile/Trigger Mechanics Mini-Batch

Implemented exactly these 3 rings:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Piercing Momentum | `RING_PROJECTILE_PIERCING_MOMENTUM` | `t1` | projectile | Projectiles gain 30% increased damage for each enemy they have pierced. | Track per-projectile pierced-hit count and expose it to hit damage scaling. |
| Backfire Shot | `RING_PROJECTILE_BACKFIRE_SHOT` | `t0` | projectile | Also fire a projectile behind you; it is not modified by projectile count. | Add weapon-fire sidecar for rear projectile spawning. |
| Lightning Chain | `RING_TRIGGER_LIGHTNING_CHAIN` | `t0` | trigger | 25% chance to trigger a lightning chain hitting up to 3 targets for 100% damage. | Add chain or bounded multi-target trigger action. |

Why this phase is grouped:

- All three modify projectile/trigger delivery rather than base stat resolution.
- They should share tests around projectile payload metadata, target selection, and no duplicate reward behavior.

### Phase 3: Poison/Ignite Hazard Mini-Batch

Implement exactly these 5 rings:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Poison Trail | `RING_POISON_POISON_TRAIL` | `t2` | poison | Leave a poison-applying trail hazard. | Add player trail hazard spawning and poison-zone application. |
| Laser Executor | `RING_IGNITE_LASER_EXECUTOR` | `t1` | ignite | Execute nearby low-life enemies with a laser-style effect. | Add low-life execute scanner/action plus presentation hook. |
| Plague Detonation | `RING_POISON_PLAGUE_DETONATION` | `t0` | poison | Poisoned enemies explode on death for 50% max life as chaos damage. | Add poisoned-target death trigger condition using existing explosion damage. |
| Smoldering Drag | `RING_IGNITE_SMOLDERING_DRAG` | `t3` | ignite | Ignited enemies are slowed by 10%. | Add enemy slow status/effect consumer tied to ignite. |
| Weakening Venom | `RING_POISON_WEAKENING_VENOM` | `t2` | poison | Poisoned enemies deal 20% less damage. | Add incoming-player-damage rule that reads attacker poison state. |

Why this phase is grouped:

- It creates the shared enemy status/hazard layer needed by the remaining poison and ignite payoffs.
- Plague Detonation is included here because its exact trigger condition depends on poison state.

### Phase 4: Physical Control/Empower Mini-Batch

Implement exactly these 5 rings:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Retaliation Burst | `RING_PHYSICAL_RETALIATION_BURST` | `t2` | physical | Taking damage has a chance to trigger an explosion, stunning nearby enemies for 1 second. | Add player-damage trigger support plus stun. |
| Staggering Blows | `RING_PHYSICAL_STAGGERING_BLOWS` | `t3` | physical | Physical hits have a 5% chance to stun enemies for 0.5 seconds. | Add stun status and physical-hit stun rule. |
| Heavy Chamber | `RING_PHYSICAL_HEAVY_CHAMBER` | `t2` | physical | Every 4 seconds, empower your next shot to deal 50% increased physical damage. | Add timed next-shot empower runtime. |
| Kill Momentum | `RING_GENERIC_KILL_MOMENTUM` | `t2` | generic | Killing an enemy empowers your next shot to deal 20% increased damage. | Reuse next-shot empower runtime from kill events. |
| Critical Sprint | `RING_CRIT_CRITICAL_SPRINT` | `t0` | crit | Critically striking grants 20% movement speed for 1 second. | Add temporary player stat buff runtime. |

Why this phase is grouped:

- Stun, player-damage triggers, next-shot empower, and temporary buffs all need short-lived runtime state.
- Heavy Chamber and Kill Momentum should share the same next-shot empower model.

### Phase 5: Slot Position Chase Mini-Batch

Implement exactly these 2 rings:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Mirror Band | `RING_UTILITY_MIRROR_BAND` | `t0` | utility | Mirrors the effect of the ring to the left of this ring. | Add neighbor-ring effect graph with loop prevention. |
| Amplifying Band | `RING_UTILITY_AMPLIFYING_BAND` | `t0` | utility | Increases the effect of surrounding rings by 50%. | Add adjacent-ring effect scalar graph. |

Why this phase waits:

- These rings are chase-tier and touch the effect graph itself.
- They need careful loop prevention and deterministic ordering after the other runtime effect surfaces are stable.

### Phase 6: Living Bomb Setpiece Mini-Batch

Implement exactly this 1 ring:

| Ring | Proposed Ring ID | Tier | Runtime Family | Exact Effect Direction | Main Upgrade |
|---|---|---|---|---|---|
| Living Bomb | `RING_IGNITE_LIVING_BOMB` | `t0` | ignite | Every 20 seconds, mark an enemy; the marked enemy gains 50% movement speed and explodes on death for 300% max life as fire damage. | Add timed enemy mark, enemy speed modifier, death explosion link, and presentation. |

Why this phase is last:

- It is a multi-system setpiece ring with timed targeting, enemy mutation, death behavior, and visual readability.
- It should reuse hazard/status and death-trigger infrastructure from earlier phases where possible.

### Deferred Block Work

These rings remain out of scope for the non-block completion push:

| Ring | Tier | Reason |
|---|---|---|
| Panic Guard | `t2` | Exact behavior grants block once per floor. |
| Glass Aegis | `t2` | Needs block charges plus after-break payoff. |
| Reprisal Barrier | `t2` | Needs block events and shockwave/knockback. |
| Block Renewal | `t3` | Needs block charges plus floor lifecycle refresh. |
| Extra Guard | `t2` | Needs maximum block-charge stat. |
| Guarded Momentum | `t3` | Needs block events plus timed movement buff. |
| Counterguard | `t2` | Needs block events plus next-shot empower. |
| Deflecting Tradeoff | `t2` | Needs block charges. |
| Guarded Ammunition | `t2` | Needs block charges plus post-pierce conditional damage. |

### Batch Completion Rules

For each phase:

- Create a draft contract before code changes.
- Read the whole contract before implementation.
- Implement exact ring behavior only; no approximation rings.
- Add ring content, runtime support, focused tests, catalog smoke coverage, and current-truth doc updates.
- Run typecheck, targeted tests, and `git diff --check`.
- Move the contract to implemented after verification.
