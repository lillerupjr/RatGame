# RatGame V1 Ring Content Catalog

## Status

IMPLEMENTED baseline.

This is the canonical authored V1 ring catalog currently shipped by the repo.

The catalog is ring-first.
Old relic definitions are historical reference material only.

---

## Content Pass Scope

The first authored V1 content pass is intentionally narrow:

* every ring has an authored tier string: `t0`, `t1`, `t2`, or `t3`
* every family tree exists and is empty
* no family talent nodes are authored yet
* no upgrade variants are authored yet

---

## Authored Tier Assignments

Current authored tiers are copied from `docs/design/ratgame_ring_tiering_sheet.md`.

| Tier | Ring IDs |
|---|---|
| `t0` | `RING_PROJECTILE_SCATTER_SHOT`, `RING_PROJECTILE_BACKFIRE_SHOT`, `RING_TRIGGER_BAZOOKA_ON_HIT`, `RING_TRIGGER_LIGHTNING_CHAIN`, `RING_TRIGGER_DOUBLE_TRIGGERS` |
| `t1` | `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50`, `RING_PHYSICAL_PURE_FORCE`, `RING_PHYSICAL_DEVOTION`, `RING_PROJECTILE_ADDITIONAL_PROJECTILES_1`, `RING_PROJECTILE_PIERCING_MOMENTUM`, `RING_PROJECTILE_BOUNCE_ADD_1`, `RING_DOT_SPECIALIST`, `RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS`, `RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS`, `RING_IGNITE_SPREAD_ON_DEATH`, `RING_IGNITE_CRITS_APPLY_IGNITE`, `RING_CRIT_ROLLS_TWICE`, `RING_TRIGGER_EXPLODE_ON_KILL`, `RING_TRIGGER_PROC_CHANCE_PERCENT_50`, `RING_TRIGGER_RETRY_FAILED_PROCS_ONCE`, `RING_HEALTH_VITAL_FORCE`, `RING_UTILITY_WIDER_SELECTION`, `RING_UTILITY_CURATED_REWARDS`, `RING_UTILITY_SELECTIVE_HAND` |
| `t2` | `RING_STARTER_STREET_REFLEX`, `RING_STARTER_LUCKY_CHAMBER`, `RING_STARTER_CONTAMINATED_ROUNDS`, `RING_STARTER_POINT_BLANK_CARNAGE`, `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30`, `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30`, `RING_PROJECTILE_GAIN_PIERCE_1`, `RING_PROJECTILE_CLOSE_QUARTERS_GUARD`, `RING_DOT_DAMAGE_OVER_TIME_MORE_50`, `RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25`, `RING_TRIGGER_SPARK_ON_HIT`, `RING_TRIGGER_DAGGER_ON_KILL`, `RING_HEALTH_WOUNDED_FURY` |
| `t3` | `RING_STARTER_THERMAL_STARTER`, `RING_GENERIC_DAMAGE_PERCENT_20`, `RING_GENERIC_DAMAGE_PERCENT_10`, `RING_GENERIC_MOVE_SPEED_20`, `RING_GENERIC_MOVE_SPEED_10`, `RING_PHYSICAL_DAMAGE_PERCENT_20`, `RING_PHYSICAL_DAMAGE_PERCENT_10`, `RING_PROJECTILE_DAMAGE_INCREASED_10`, `RING_POISON_CHANCE_PERCENT_25`, `RING_POISON_CHANCE_PERCENT_10`, `RING_IGNITE_CHANCE_PERCENT_10`, `RING_CRIT_CHANCE_PERCENT_5`, `RING_TRIGGER_PROC_CHANCE_PERCENT_10`, `RING_HEALTH_MAX_LIFE_ADD_10`, `RING_HEALTH_FLOOR_RECOVERY` |

Starter rings are tiered for inspection and future tuning, but normal generated ring rewards exclude the `starter` family.

---

## Shipped Ring Families

### Starter

Git-history-backed starter names, descriptions, and baseline behaviors:

* `RING_STARTER_STREET_REFLEX`
* `RING_STARTER_LUCKY_CHAMBER`
* `RING_STARTER_CONTAMINATED_ROUNDS`
* `RING_STARTER_POINT_BLANK_CARNAGE`
* `RING_STARTER_THERMAL_STARTER`

Implemented starter loadout mapping:

* `JAMAL` -> `RING_STARTER_STREET_REFLEX`
* `JACK` -> `RING_STARTER_LUCKY_CHAMBER`
* `HOBO` -> `RING_STARTER_CONTAMINATED_ROUNDS`
* `TOMMY` -> `RING_STARTER_POINT_BLANK_CARNAGE`
* `JOEY` -> `RING_STARTER_THERMAL_STARTER`

Runtime note:

* run start equips the selected character's starter ring directly into `LEFT:0`

### Generic

* `RING_GENERIC_DAMAGE_PERCENT_20`
* `RING_GENERIC_DAMAGE_PERCENT_10`
* `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30`
* `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30`
* `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50`
* `RING_GENERIC_MOVE_SPEED_20`
* `RING_GENERIC_MOVE_SPEED_10`

Provenance:

* direct git-history-backed references:
  * `RING_GENERIC_DAMAGE_PERCENT_20`
  * `RING_GENERIC_MOVE_SPEED_20`
* deliberate V1 value overrides of older passive patterns:
  * `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30`
  * `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30`
  * `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50`
* content-only expansion additions:
  * `RING_GENERIC_DAMAGE_PERCENT_10`
  * `RING_GENERIC_MOVE_SPEED_10`

### Physical

* `RING_PHYSICAL_DAMAGE_PERCENT_20`
* `RING_PHYSICAL_DAMAGE_PERCENT_10`
* `RING_PHYSICAL_PURE_FORCE`
* `RING_PHYSICAL_DEVOTION`

Provenance:

* new V1 ring content backed by a new physical-hit modifier primitive
* content-only expansion addition:
  * `RING_PHYSICAL_DAMAGE_PERCENT_10`
* conditional combat-rule mini-batch additions:
  * `RING_PHYSICAL_PURE_FORCE`
  * `RING_PHYSICAL_DEVOTION`

### Projectile

* `RING_PROJECTILE_ADDITIONAL_PROJECTILES_1`
* `RING_PROJECTILE_GAIN_PIERCE_1`
* `RING_PROJECTILE_PIERCING_MOMENTUM`
* `RING_PROJECTILE_DAMAGE_INCREASED_10`
* `RING_PROJECTILE_BOUNCE_ADD_1`
* `RING_PROJECTILE_SCATTER_SHOT`
* `RING_PROJECTILE_BACKFIRE_SHOT`
* `RING_PROJECTILE_CLOSE_QUARTERS_GUARD`

Provenance:

* value references recovered from older projectile card content
* projectile stat expansion additions:
  * `RING_PROJECTILE_DAMAGE_INCREASED_10`
  * `RING_PROJECTILE_BOUNCE_ADD_1`
  * `RING_PROJECTILE_SCATTER_SHOT`
* conditional combat-rule mini-batch addition:
  * `RING_PROJECTILE_CLOSE_QUARTERS_GUARD`
* projectile/trigger mechanics mini-batch additions:
  * `RING_PROJECTILE_PIERCING_MOMENTUM`
  * `RING_PROJECTILE_BACKFIRE_SHOT`

### DOT

* `RING_DOT_DAMAGE_OVER_TIME_MORE_50`
* `RING_DOT_SPECIALIST`
* `RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS`

Provenance:

* direct git-history-backed references:
  * `RING_DOT_DAMAGE_OVER_TIME_MORE_50`
  * `RING_DOT_SPECIALIST`
* new V1 combat-rule content:
  * `RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS`

### Chaos

* `RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS`

Provenance:

* new V1 combat-rule content

### Poison

* `RING_POISON_CHANCE_PERCENT_25`
* `RING_POISON_CHANCE_PERCENT_10`
* `RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25`

Provenance:

* direct git-history-backed value reference:
  * `RING_POISON_CHANCE_PERCENT_25`
* new V1 combat-rule content:
  * `RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25`
* content-only expansion addition:
  * `RING_POISON_CHANCE_PERCENT_10`

### Ignite

* `RING_IGNITE_SPREAD_ON_DEATH`
* `RING_IGNITE_CRITS_APPLY_IGNITE`
* `RING_IGNITE_CHANCE_PERCENT_10`

Provenance:

* direct git-history-backed reference:
  * `RING_IGNITE_SPREAD_ON_DEATH`
* new V1 trigger action content:
  * `RING_IGNITE_CRITS_APPLY_IGNITE`
* content-only expansion addition:
  * `RING_IGNITE_CHANCE_PERCENT_10`

### Crit

* `RING_CRIT_ROLLS_TWICE`
* `RING_CRIT_CHANCE_PERCENT_5`

Provenance:

* direct git-history-backed reference
* content-only expansion addition:
  * `RING_CRIT_CHANCE_PERCENT_5`

### Trigger

* `RING_TRIGGER_BAZOOKA_ON_HIT`
* `RING_TRIGGER_LIGHTNING_CHAIN`
* `RING_TRIGGER_SPARK_ON_HIT`
* `RING_TRIGGER_EXPLODE_ON_KILL`
* `RING_TRIGGER_DAGGER_ON_KILL`
* `RING_TRIGGER_DOUBLE_TRIGGERS`
* `RING_TRIGGER_PROC_CHANCE_PERCENT_50`
* `RING_TRIGGER_PROC_CHANCE_PERCENT_10`
* `RING_TRIGGER_RETRY_FAILED_PROCS_ONCE`

Provenance:

* direct git-history-backed references:
  * `RING_TRIGGER_SPARK_ON_HIT`
  * `RING_TRIGGER_EXPLODE_ON_KILL`
  * `RING_TRIGGER_DAGGER_ON_KILL`
  * `RING_TRIGGER_DOUBLE_TRIGGERS`
  * `RING_TRIGGER_PROC_CHANCE_PERCENT_50`
  * `RING_TRIGGER_RETRY_FAILED_PROCS_ONCE`
* deliberate V1 value override of an older trigger pattern:
  * `RING_TRIGGER_BAZOOKA_ON_HIT`
* content-only expansion addition:
  * `RING_TRIGGER_PROC_CHANCE_PERCENT_10`
* projectile/trigger mechanics mini-batch addition:
  * `RING_TRIGGER_LIGHTNING_CHAIN`

### Health

* `RING_HEALTH_MAX_LIFE_ADD_10`
* `RING_HEALTH_FLOOR_RECOVERY`
* `RING_HEALTH_VITAL_FORCE`
* `RING_HEALTH_WOUNDED_FURY`

Provenance:

* content-only expansion addition backed by the existing life stat modifier pipeline
* health/floor lifecycle mini-batch additions:
  * `RING_HEALTH_FLOOR_RECOVERY`
  * `RING_HEALTH_VITAL_FORCE`
  * `RING_HEALTH_WOUNDED_FURY`

### Defense

No authored rings in this pass.

### Utility

* `RING_UTILITY_WIDER_SELECTION`
* `RING_UTILITY_CURATED_REWARDS`
* `RING_UTILITY_SELECTIVE_HAND`

Provenance:

* reward manipulation mini-batch additions:
  * `RING_UTILITY_WIDER_SELECTION`
  * `RING_UTILITY_CURATED_REWARDS`
  * `RING_UTILITY_SELECTIVE_HAND`

---

## Deliberate V1 Overrides

These rings intentionally diverge from the closest old relic values while keeping the old pattern as the first reference:

* `RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30`
* `RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30`
* `RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50`
* `RING_TRIGGER_BAZOOKA_ON_HIT`

---

## Authoring Rule

New authored progression content must be added here through the ring registry only.
Do not restore relic-owned content registries or card-owned passive ownership for progression content.

---

## QA Status

Current implemented QA coverage includes:

* exact ring id and family-tree validation for the tiered V1 catalog
* exact authored tier assertions for every shipped ring
* recovered starter name/description assertions
* per-ring smoke coverage through the ring inspection/runtime surfaces
* targeted behavior tests for projectile-only damage, projectile bounce spawning, conditional combat rules, health/floor lifecycle effects, reward manipulation rules, projectile/trigger mechanics, starter loadout wiring, trigger proc modifiers, bazooka, dagger, thermal-starter burning damage, and the previously shipped trigger/combat-rule behaviors
