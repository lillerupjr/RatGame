# RatGame Ring Design State

Status snapshot for the ring expansion pass.

## Goal

- Target ring count: **60**
- Locked rings: **49**
- Tentative candidates: **15**
- Total if all tentative are accepted: **64**
- Current over-target if all accepted: **4**

## Brainstorming Rule for Future Ring Candidates

When the user proposes a ring, respond with **3 new ring candidates** that fit the same design space.

Important rule:

> Response candidates must be **standalone rings first**, not upgrades that only work if the user's ring exists.

Good response candidates should:

- Work independently.
- Reward synergy without requiring another specific ring.
- Use the same family, system, trigger condition, damage type, or tactical idea.
- Be simple enough to evaluate quickly.
- Avoid too much dependency wording like “your poison trail lasts longer” unless the effect can exist on its own.
- Prefer “synergy hooks” over hard dependencies.

Example:

Bad candidate:

- Poison trails last longer.

Better candidates:

- While moving, gain poison chance.
- Poisoned enemies are slowed.
- Enemies you poison leave toxic puddles on death.

These all work alone, but still pair well with a poison-trail ring.

## Current Families

Base families currently represented:

- starter
- generic
- physical
- projectile
- dot
- chaos
- poison
- ignite
- crit
- trigger
- fire
- health
- defense
- movement
- other
- family

Hybrid family tags are allowed, for example:

- defense / projectile
- defense / trigger
- health / defense
- family / physical

---

# Locked Rings

| # | Ring | Family | Description |
|---:|---|---|---|
| 1 | Street Reflex | starter | On hit, 20% chance to throw an additional knife at a nearby enemy. |
| 2 | Lucky Chamber | starter | Every 5th shot is guaranteed to crit. |
| 3 | Contaminated Rounds | starter | Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits. |
| 4 | Point Blank Carnage | starter | Deal up to +50% damage based on proximity. Very close hits knock enemies back. |
| 5 | Thermal Starter | starter | Deal +15% damage to burning enemies. |
| 6 | 20% More Damage | generic | 20% more damage. |
| 7 | 60% More Damage / 30% Less Attack Speed | generic | 60% more damage. 30% less attack speed. |
| 8 | 60% More Attack Speed / 30% Less Damage | generic | 60% more attack speed. 30% less damage. |
| 9 | 100% More Damage / 50% Less Maximum Life | generic | 100% more damage. 50% less maximum life. |
| 10 | 20% More Movement Speed | generic | 20% more movement speed. |
| 11 | 20% More Physical Damage | physical | 20% more physical damage. |
| 12 | +1 Projectile | projectile | You gain +1 projectile. |
| 13 | +1 Pierce | projectile | Your projectiles gain +1 pierce. |
| 14 | 50% More Damage Over Time | dot | Damage over time deals 50% more damage. |
| 15 | DOT Specialist | dot | 50% less hit damage. Damage over time deals 200% more damage. |
| 16 | Triggered Hits Can Apply DOTs | dot | Damaging hits from triggered effects can apply DOTs. |
| 17 | All Hit Damage Converted to Chaos | chaos | All hit damage is converted to chaos damage, including triggered effects. |
| 18 | +25% Poison Chance | poison | Gain +25% poison chance. |
| 19 | Poisons Can Add an Extra Stack | poison | Poisons have 25% chance to apply an additional stack. |
| 20 | Ignite Spreads on Death | ignite | Ignite spreads to nearby enemies on death. |
| 21 | Crits Apply Ignite | ignite | Crits ignite the target for 100% of the hit damage. |
| 22 | Crit Rolls Twice | crit | Crit rolls twice. |
| 23 | Bazooka on Hit | trigger | On hit: 10% chance to fire a bazooka dealing 300% of hit damage as physical damage. |
| 24 | Spark on Hit | trigger | On hit: 20% chance to zap the nearest enemy dealing 100% of hit damage as fire damage. |
| 25 | Explode on Kill | trigger | On kill: 20% chance for enemies to explode, dealing 50% of their maximum life as physical damage. |
| 26 | Dagger on Kill | trigger | On kill: 50% chance to fire a homing dagger at the nearest enemy dealing 100% of hit damage as physical damage. |
| 27 | Double Triggers | trigger | All triggers happen twice. |
| 28 | +50% Trigger Proc Chance | trigger | +50% increased trigger chance. |
| 29 | Retry Failed Procs Once | trigger | Failed procs retry once. |
| 30 | Poison Trail | poison | Leaves a poison trail behind the player, poisoning enemies that walk through it. |
| 31 | Laser Executor | fire | Nearby enemies below 15% life are executed by a laser beam. |
| 32 | Floor Recovery | health | Heal 10 health after completing a floor. |
| 33 | Vital Force | health | Deal increased damage equal to 20% of your maximum health. |
| 34 | Wounded Fury | health | Deal 5% increased damage for each 10 health missing. |
| 35 | Retaliation Burst | physical | Taking damage has a chance to trigger an explosion, stunning nearby enemies for 1 second. |
| 36 | Staggering Blows | physical | Your physical hits have a 5% chance to stun enemies for 0.5 seconds. |
| 37 | Mirror Band | other | Mirrors the effect of the ring to the left of this ring. |
| 38 | Amplifying Band | other | Increases the effect of surrounding rings by 50%. |
| 39 | Physical Devotion | family / physical | Deal 20% increased damage for each equipped physical-family ring. |
| 40 | Pure Force | physical | Your physical damage is increased by 30%, but you deal no non-physical damage. |
| 41 | Glass Aegis | defense | Gain a shield that blocks one hit. After it breaks, gain increased damage for a short duration. |
| 42 | Reprisal Barrier | defense / trigger | When you block damage, release a shockwave that damages and knocks back nearby enemies. |
| 43 | Block Renewal | defense | At the start of each floor, refresh your block. |
| 44 | Extra Guard | defense | Gain +1 maximum block charge. |
| 45 | Guarded Momentum | defense / movement | After blocking a hit, gain movement speed for a short duration. |
| 46 | Counterguard | defense / trigger | After blocking a hit, your next hit deals increased damage. |
| 47 | Deflecting Tradeoff | defense / projectile | Lose 1 pierce. Gain 1 block. |
| 48 | Guarded Ammunition | defense / projectile | Gain +1 block. Projectiles deal reduced damage after piercing. |
| 49 | Close Quarters Guard | defense / projectile | While you have no pierce, gain increased damage against nearby enemies. |

---

# Tentative Candidates

| # | Ring | Family | Description |
|---:|---|---|---|
| T1 | Ricochet Rounds | projectile | Your projectiles gain +1 bounce. |
| T2 | Piercing Momentum | projectile | Your projectiles gain 30% increased damage for each enemy they have pierced. |
| T3 | Wider Selection | other | Ring rewards offer +1 additional option. |
| T4 | Selective Hand | other | After each floor, you may reroll ring rewards once. |
| T5 | Curated Rewards | other | Ring rewards are slightly more likely to contain a family you already have equipped. |
| T6 | Small Damage Band | generic | Deal 10% more damage. |
| T7 | Quick Step | generic | Gain 10% movement speed. |
| T8 | Bruiser’s Band | physical | Deal 10% more physical damage. |
| T9 | Sharpened Tip | projectile | Projectiles deal 10% increased damage. |
| T10 | Dirty Needle | poison | Gain 10% poison chance. |
| T11 | Small Spark | ignite | Gain 10% ignite chance. |
| T12 | Lucky Scratch | crit | Gain 5% increased crit chance. |
| T13 | Twitchy Mechanism | trigger | Gain 10% increased trigger proc chance. |
| T14 | Minor Vitality | health | Gain 10 maximum life. |
| T15 | Panic Guard | defense | When you drop below 30% life, gain 1 block. Once per floor. |

---

# Removed / Rejected During Session

| Ring | Status |
|---|---|
| Prepared Guard | Rejected. |
| First Ward | Removed. |
| Shield Renewal | Removed. |
| Splinter Shield | Rejected. |

---

# Notes

- “Block” is the preferred defensive wording.
- Avoid “negated” for block mechanics.
- Some rings mention “shield” because that was the original wording of the candidate. This may need normalization later if the engine uses only block charges.
- The locked list contains some high-tier, build-defining rings and some simple filler rings.
- The tentative list is intentionally over target so final selection can cut weak or redundant entries.
