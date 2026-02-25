# RatGame Relic System — Master Design Contract (V1–V5)

Status: ACTIVE
Owner: RatGame Team
Scope: Defines relic system philosophy, architecture, proof-of-concept relics, armor system, playstyle archetypes, and long-term expansion model.

This document is the authoritative source for relic system design.

---

# 1. Core Philosophy

## 1.1 Horizontal Scaling Principle

Relics expand combat horizontally, not vertically.

Relics primarily add:

* New triggers
* New scaling paths
* New combat behaviors
* New interaction chains
* New playstyles

Relics should NOT primarily provide flat stat increases.

Bad relic example:

```
+50% damage
```

Good relic examples:

```
On hit → fire missile
On kill → explosion
Triggers happen twice
Life contributes to damage
```

Power emerges from combinations, not individual relic strength.

---

## 1.2 Playstyle Creation Principle (V3+)

From V3 onward, relics must create playstyles, not just effects.

Relics should influence:

* How the player fights
* What actions are rewarded
* Combat pacing and flow
* Build identity

Examples of playstyle-defining mechanics:

* Momentum scaling
* Movement scaling
* Sustain scaling
* Control scaling
* Specialization tradeoffs

---

## 1.3 Naming Contract (Internal ID + Display Name)

All relics must follow these naming rules:

* Internal IDs:
  * Uppercase snake case.
  * Category prefixes only (`PASS_`, `ACT_`, `MOM_`, `SPEC_`, `ARMOR_`).
  * Include numeric qualifiers when the effect has a fixed value (`_20`, `_2P`, `_2`, etc.).
* Display names:
  * Must be descriptive effect text.
  * Must not use flavor-only names.
  * Must describe what the relic does at runtime.

Examples:

* `ACT_ALL_HITS_EXPLODE_20` -> `All hits explode for 20% damage`
* `ACT_TRIGGERS_DOUBLE` -> `All triggers happen twice`
* `PASS_LIFE_ON_HIT_2` -> `Heal 2 life on hit`

---

# 2. Power Budget Rule

Baseline relic power budget:

Typical relic:

```
+20% to +100% effective power
```

Maximum standalone relic power:

```
+200% effective power
```

Synergies may exceed this limit.

Relics should derive strength primarily from interaction.

---

# 3. Relic System Architecture

## 3.1 Core Relic Categories

All relics belong to one or more categories:

1. Proc Relics — add triggered effects
2. Amplifier Relics — multiply trigger effectiveness
3. Conversion Relics — convert one stat into another
4. Behavior Relics — modify damage behavior
5. Passive Relics — modify stats or sustain
6. Momentum Relics — reward continuous combat engagement
7. Control Relics — apply slow, freeze, stun, or other control
8. Specialization Relics — introduce tradeoffs
9. World Relics — modify global combat rules

---

## 3.2 Relic Effect Model

Relics may implement one or more of:

```
stat modifiers
event triggers
trigger amplification
stat conversion
behavior modification
temporary state scaling
world modification
```

Relics must operate through the generic event system.

Relics must NOT hardcode weapon-specific logic.

---

# 4. V1 — Proof of Concept Relics

Purpose: Validate core relic pipeline.

These relics are mandatory for system validation.

---

## 4.1 Active / Trigger Relics

### RELIC_ACT_MISSILE_ON_HIT

```
OnHit:
  20% chance to fire homing missile
Missile damage = 100% base damage
```

Validates:

* OnHit triggers
* Proc chance pipeline
* Trigger spawning

---

### RELIC_ACT_EXPLODE_ON_KILL

```
OnEnemyKilled:
  Explosion dealing 50% of enemy max life
```

Validates:

* OnKill triggers
* AoE spawning
* Chain reactions

---

### ACT_ALL_HITS_EXPLODE_20

```
Every hit causes explosion dealing 20% damage
```

Validates:

* Behavior modification pipeline

---

### ACT_LIFE_TO_DAMAGE_2P

```
Gain damage equal to 2% of max life
```

Validates:

* Stat conversion pipeline

---

### ACT_TRIGGERS_DOUBLE

```
All triggers execute twice
```

Validates:

* Trigger amplification pipeline

Critical long-term relic archetype.

---

## 4.2 Passive Relics

### RELIC_PASS_DAMAGE_PERCENT

```
Deal 20% more damage
```

---

### RELIC_PASS_MOVE_SPEED

```
+20% movement speed
```

---

### RELIC_PASS_LIFE_TO_DAMAGE

```
Gain 1–3% of max life as damage
```

---

### PASS_CRIT_ROLLS_TWICE

```
Crit rolls twice
```

---

### PASS_DAMAGE_TO_POISON_ALL

```
All damage contributes to poison
```

---

### PASS_LIFE_ON_HIT_2

```
Heal 2 life on hit
```

---

## 4.3 V1 Completion Criteria

System is operational when:

* All relics function correctly
* Relics stack correctly
* Trigger amplification works safely
* No infinite trigger loops exist

---

# 5. V2 — Interaction Expansion

Purpose: Expand proc ecosystem.

Examples:

* Chain lightning on hit
* Explosion chains
* Proc chance amplification
* Trigger-on-crit effects
* Trigger-on-damage effects

This expands interaction density.

---

# 6. V3 Core System — Armor

## 6.1 Armor Definition

Armor is a finite defensive resource.

Armor absorbs damage before Life.

Armor does NOT regenerate automatically.

Armor can only be restored via explicit effects.

---

## 6.2 Armor Properties

```
maxArmor
currentArmor
```

---

## 6.3 Damage Resolution

```
Damage → Armor → Life
```

---

## 6.4 Armor Restoration Sources

Armor can be restored via:

* Relics
* Cards
* Pickups
* OnHit effects
* OnKill effects
* OnCrit effects

Armor cannot regenerate passively.

---

## 6.5 Example Armor Relics

```
+50 max Armor

Restore 10 Armor on kill

Restore 1 Armor on hit

Restore 5 Armor on crit

Double max Armor
```

---

# 7. V3 Core System — Momentum

Momentum relics reward continuous combat engagement.

Momentum is temporary.

Momentum is lost when engagement stops.

Example:

### RELIC_V3_MOMENTUM_DAMAGE

```
Gain +5% damage per second while continuously hitting enemies

Stacks up to +100%

Resets after 2 seconds without hits
```

Momentum creates skill-based scaling.

---

# 8. Build Archetypes

These define supported playstyles.

---

## 8.1 Proc Build

Optimizes trigger frequency.

---

## 8.2 Momentum Build

Optimizes sustained combat engagement.

---

## 8.3 Armor Build

Optimizes combat sustain.

---

## 8.4 Zoomer Build

Optimizes movement speed scaling.

Example:

```
Gain damage based on movement speed
```

---

## 8.5 Crit Build

Optimizes critical strikes.

---

## 8.6 Control Build

Optimizes slow, freeze, and stun.

---

## 8.7 Status Build

Optimizes poison, ignite, bleed.

---

## 8.8 Heavy Build

Optimizes large individual hits.

---

## 8.9 Swarm Build

Optimizes high attack speed.

---

## 8.10 Execute Build

Optimizes finishing enemies.

---

# 9. V4 — Specialization Relics

Specialization relics introduce tradeoffs.

Examples:

```
+100% damage
-40% attack speed
```

```
+50% attack speed
-30% damage
```

These create focused builds.

---

# 10. V5 — Relic Interaction Scaling

Relics may scale with relic count.

Example:

```
+5% damage per relic owned
```

This increases synergy depth.

---

# 11. Design Constraints

Relics must:

* Use generic trigger pipeline
* Remain deterministic
* Be composable
* Avoid hardcoded logic

Relics must NOT:

* Introduce hidden mechanics
* Break determinism
* Introduce infinite loops

---

# 12. Long-Term Goal

Enable emergent builds such as:

* Proc chain builds
* Momentum builds
* Armor sustain builds
* Zoomer builds
* Control builds
* Status builds
* Crit builds

Relics must enable playstyle diversity.

---

# RatGame Relic Roadmap (V1–V6)

Status: ACTIVE IMPLEMENTATION ROADMAP
Purpose: Define relic implementation order, validate system architecture, and ensure archetype coverage.

Relics are grouped by version and system purpose.

---

# Implementation Progress (as of February 25, 2026)

Completed and shipped in code:

* ID migration from legacy `RELIC_*` to internal category IDs (`PASS_*`, `ACT_*`) with runtime backward-compat normalization.
* Debug Relics Editor in Pause menu (add/remove relics live, deduped).
* Passive relics:
  * `PASS_MOVE_SPEED_20`
  * `PASS_DAMAGE_PERCENT_20`
  * `PASS_LIFE_TO_DAMAGE_2P` (currently tuned to 20% max-life conversion in code).
* Active relics:
  * `ACT_MISSILE_ON_HIT_20`
  * `ACT_BAZOOKA_ON_HIT_20`
  * `ACT_EXPLODE_ON_KILL`
* Relic trigger loop safety:
  * Trigger events with source `OTHER` are ignored for proc relic triggering.
* Projectile modernization:
  * `PRJ_KIND.BAZOOKA` replaced by `PRJ_KIND.MISSILE` (same numeric slot).
  * Targeted missile arrival is overshoot-safe and explodes reliably.
* Bazooka weapon content removed:
  * Removed `BAZOOKA` and `BAZOOKA_EVOLVED` weapon defs and related upgrade/starter references.

---

# V1 — Proof of Concept Relics (Core Pipeline Validation)

These relics validate the fundamental relic system.

| Relic ID                        | Name             | Type       | Effect                                | Purpose                        |
| ------------------------------- | ---------------- | ---------- | ------------------------------------- | ------------------------------ |
| RELIC_ACT_MISSILE_ON_HIT        | Missile Battery  | Proc       | 20% OnHit → homing missile (100% dmg) | Validate trigger spawning      |
| RELIC_ACT_EXPLODE_ON_KILL       | Volatile Corpses | Proc       | OnKill → explosion (50% max HP)       | Validate kill triggers         |
| ACT_ALL_HITS_EXPLODE_20         | Impact Detonator | Behavior   | All hits explode (20% dmg)            | Validate behavior modification |
| ACT_LIFE_TO_DAMAGE_2P           | Blood Converter  | Conversion | Gain damage = 2% max life             | Validate stat conversion       |
| ACT_TRIGGERS_DOUBLE             | Echo Engine      | Amplifier  | All triggers execute twice            | Validate trigger amplification |
| RELIC_PASS_DAMAGE_PERCENT       | Sharpened Edge   | Passive    | +20% damage                           | Validate stat modifiers        |
| RELIC_PASS_MOVE_SPEED           | Light Frame      | Passive    | +20% movement speed                   | Validate movement scaling      |
| RELIC_PASS_LIFE_TO_DAMAGE       | Giant’s Blood    | Conversion | Gain damage from max life             | Validate derived stats         |
| PASS_CRIT_ROLLS_TWICE           | Lucky Charm      | Amplifier  | Crit rolls twice                      | Validate crit pipeline         |
| PASS_DAMAGE_TO_POISON_ALL       | Toxic Catalyst   | Conversion | All damage contributes to poison      | Validate status conversion     |
| PASS_LIFE_ON_HIT_2              | Vampiric Strike  | Sustain    | Heal 2 life on hit                    | Validate sustain pipeline      |

---

# V2 — Proc Ecosystem Expansion

These relics expand trigger interaction density.

| Relic ID                     | Name             | Type      | Effect                  | Enables            |
| ---------------------------- | ---------------- | --------- | ----------------------- | ------------------ |
| RELIC_V2_CHAIN_LIGHTNING     | Tesla Coil       | Proc      | OnHit → chain lightning | Proc builds        |
| RELIC_V2_DAGGER_ON_KILL      | Soul Shards      | Proc      | OnKill → homing dagger  | Kill chains        |
| RELIC_V2_NOVA_ON_CRIT        | Critical Surge   | Proc      | OnCrit → nova explosion | Crit builds        |
| RELIC_V2_RETRY_FAILED_PROCS  | Fate Engine      | Amplifier | Failed procs retry once | Proc amplification |
| RELIC_V2_PROC_CHANCE_PERCENT | Overclock Module | Amplifier | +50% proc chance        | Proc scaling       |
| RELIC_V2_POISON_EXPLODE      | Plague Reactor   | Behavior  | Poison kills explode    | Status builds      |
| RELIC_V2_IGNITE_SPREAD       | Wildfire Core    | Behavior  | Ignite spreads on death | Status builds      |

---

# V3 — Armor and Momentum Systems

Introduces new scaling axes.

---

## Armor Relics

Armor is a finite defensive resource.

| Relic ID               | Name               | Type      | Effect                   | Enables        |
| ---------------------- | ------------------ | --------- | ------------------------ | -------------- |
| RELIC_V3_ARMOR_MAX     | Reinforced Plating | Passive   | +50 max Armor            | Armor builds   |
| RELIC_V3_ARMOR_ON_KILL | Combat Recycling   | Sustain   | Restore 10 Armor on kill | Sustain builds |
| RELIC_V3_ARMOR_ON_HIT  | Kinetic Absorption | Sustain   | Restore 1 Armor on hit   | Swarm sustain  |
| RELIC_V3_ARMOR_ON_CRIT | Precision Barrier  | Sustain   | Restore 5 Armor on crit  | Crit sustain   |
| RELIC_V3_ARMOR_DOUBLE  | Heavy Plating      | Amplifier | Double max Armor         | Tank builds    |

---

## Momentum Relics

Momentum rewards continuous engagement.

| Relic ID                   | Name             | Type     | Effect                                  | Enables           |
| -------------------------- | ---------------- | -------- | --------------------------------------- | ----------------- |
| RELIC_V3_MOMENTUM_DAMAGE   | Berserker Engine | Momentum | +5% damage/sec while hitting (max 100%) | Momentum builds   |
| RELIC_V3_KILL_CHAIN_DAMAGE | Blood Rush       | Momentum | OnKill → stacking damage buff           | Aggression builds |
| RELIC_V3_MOMENTUM_SPEED    | Adrenal Injector | Momentum | OnKill → stacking movement speed        | Zoomer builds     |

---

# V4 — Specialization Relics

Introduces tradeoffs and build identity.

| Relic ID                  | Name            | Type           | Effect                          | Enables             |
| ------------------------- | --------------- | -------------- | ------------------------------- | ------------------- |
| RELIC_V4_HEAVY_SPECIALIST | Heavy Frame     | Specialization | +100% damage, -40% attack speed | Heavy builds        |
| RELIC_V4_SWARM_SPECIALIST | Rapid Chamber   | Specialization | +50% attack speed, -30% damage  | Swarm builds        |
| RELIC_V4_GLASS_CANNON     | Glass Reactor   | Specialization | +200% damage, -50% max life     | Glass cannon builds |
| RELIC_V4_TANK_SPECIALIST  | Juggernaut Core | Specialization | +100 Armor, -20% movement speed | Tank builds         |

---

# V5 — Relic Interaction Scaling

Relics scale with relic ownership.

| Relic ID                      | Name                 | Type      | Effect                                | Enables        |
| ----------------------------- | -------------------- | --------- | ------------------------------------- | -------------- |
| RELIC_V5_RELIC_SCALING_DAMAGE | Collector’s Engine   | Scaling   | +5% damage per relic owned            | All builds     |
| RELIC_V5_TRIGGER_AMPLIFIER    | Amplification Matrix | Amplifier | Trigger effects +50% stronger         | Proc builds    |
| RELIC_V5_FIRST_STRIKE         | Assassin Core        | Behavior  | First hit on enemy deals +200% damage | Execute builds |
| RELIC_V5_EXECUTIONER          | Guillotine Protocol  | Behavior  | +100% damage vs low-life enemies      | Execute builds |

---

# V6 — Advanced Archetype Expansion

Expands unique playstyles.

---

## Zoomer Relics

| Relic ID                    | Name            | Type       | Effect                          | Enables       |
| --------------------------- | --------------- | ---------- | ------------------------------- | ------------- |
| RELIC_V6_SPEED_TO_DAMAGE    | Velocity Engine | Conversion | Gain damage from movement speed | Zoomer builds |
| RELIC_V6_MOVEMENT_SHOCKWAVE | Kinetic Pulse   | Proc       | Moving releases shockwave       | Zoomer builds |

---

## Control Relics

| Relic ID               | Name             | Type | Effect               | Enables        |
| ---------------------- | ---------------- | ---- | -------------------- | -------------- |
| RELIC_V6_FREEZE_ON_HIT | Cryo Core        | Proc | OnHit → freeze enemy | Control builds |
| RELIC_V6_SLOW_ON_HIT   | Gravity Anchor   | Proc | OnHit → slow enemy   | Control builds |
| RELIC_V6_STUN_ON_CRIT  | Neural Disruptor | Proc | OnCrit → stun enemy  | Control builds |

---

## Status Relics

| Relic ID                      | Name         | Type       | Effect                     | Enables       |
| ----------------------------- | ------------ | ---------- | -------------------------- | ------------- |
| RELIC_V6_POISON_STACK_SCALING | Venom Engine | Conversion | Poison stacks scale damage | Status builds |
| RELIC_V6_IGNITE_STACK_SCALING | Inferno Core | Conversion | Ignite stacks scale damage | Status builds |

---

# Summary

| Version | Relics | Purpose                      |
| ------- | ------ | ---------------------------- |
| V1      | 11     | Validate relic system        |
| V2      | 7      | Expand proc ecosystem        |
| V3      | 8      | Introduce Armor and Momentum |
| V4      | 4      | Introduce specialization     |
| V5      | 4      | Introduce relic scaling      |
| V6      | 7      | Expand archetypes            |
| TOTAL   | 41     | Full relic roadmap           |

---

# Implementation Priority Order

Recommended implementation sequence:

1. V1 — Proof of concept relics
2. V2 — Core proc expansion
3. V3 — Armor system relics
4. V3 — Momentum relics
5. V4 — Specialization relics
6. V5 — Relic scaling relics
7. V6 — Archetype expansion relics

---

END OF RELIC ROADMAP
