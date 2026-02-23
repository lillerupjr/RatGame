Contract: RatGame Combat Rewrite V1 (Modifiers + Cards)
Purpose

Replace the legacy VS-style weapon leveling system with a PoE-inspired stat modifier + card system while keeping RatGame’s stable engine primitives (projectiles, collisions, event queue, deterministic RNG).

This V1 supports:

Jack only

One weapon only: pistol

Cards are passive stat modifiers (no triggers, no actives)

Damage types: physical, fire, chaos

Conversion (priority-fill)

Ailments (bleed/ignite/poison) derived from dealt damage by type

Deterministic RNG

Naming and Folder Strategy
Goals

No “v2”, “combat2”, “new”, “temporary” names in runtime system files.

Clear long-term names that still allow isolation from legacy.

One obvious future step: delete legacy and optionally rename folders later.

Folder layout

We isolate by folder name, not by file name.

New system folder (isolated):

src/game/combat_mods/

Legacy system folder:

keep legacy where it currently lives, but do not import it from combat_mods/.

Rationale:

combat_mods describes the system’s identity (modifier-based combat), not its version.

When legacy is removed, you may rename combat_mods → combat in one final cleanup commit.

File Naming Rules
System files must be capability-based

✅ Good:

weaponAutoFireSystem.ts

weaponTargeting.ts

projectileHitResolution.ts

damagePipeline.ts

ailmentApplication.ts

ailmentTickSystem.ts

combatStatsResolver.ts

combatModeGate.ts

combatDebugOverlay.ts

❌ Not allowed:

combat2PistolSystem.ts

newWeaponSystem.ts

v2Damage.ts

Content files must be content-based

✅ Good:

content/weapons/jackPistol.ts

content/cards/starterCards.ts

Hard Isolation Rule
Combat mode gate

There must be a single gate that decides which combat systems register.

If combatMode = "legacy": register legacy systems only.

If combatMode = "mods": register modifier-based systems only.

No runtime should have both combat systems active.

Core Data Contracts
Damage types

V1 supported types:

physical

fire

chaos

Represent damage as a bundle:

phys, fire, chaos (numbers)

Stat modifier buckets

Engine supports:

increased/reduced (additive bucket)

more/less (multiplicative bucket)

V1 rule:

Starter cards must not include more/less

System must still support more/less for relics/high-tier later

Conversion (priority-fill, fixed order)

Conversion is applied using pool-consumption (“remaining pool”) in this fixed priority order:

physical → fire

physical → chaos

fire → chaos

Rule: later conversions consume only what remains.

Crit

Crit scales hit damage only.

Ailments scale indirectly because they derive from damage dealt.

Enemy mitigation (V1)

Armor exists in schema but is 0 initially and not implemented as a mechanic in V1.

Mitigation order:

resist

damage reduction

reduced damage taken (exists conceptually, not exposed to starter cards)

V1 cards: only damageReduction exists as a defensive mod.

Ailments V1
Application

No damage type has innate ailment chance.
Ailment application requires explicit chance stats:

chanceToBleed

chanceToIgnite

chanceToPoison

These chances may come from weapon base, cards, or relics.

Damage source rule (locked)

Ailment magnitude derives from damage dealt of its associated type:

bleed total = physicalDealt

ignite total = fireDealt

poison total = chaosDealt

Durations (locked)

ignite: 4s

poison: 2s

bleed: 6s

Stacking + caps (locked)

poison stacks: yes, independent instances, cap 20 per enemy

bleed stacks: yes, independent instances, cap 20 per enemy

ignite stacks: no

only the strongest ignite deals damage

weaker ignites are ignored (not stored as stacks)

Tick model

V1 ticks per-frame using dps * dt.
Future: fixed tick rate (PoE server tick style).

Starter Cards V1 Rules

Cards are passive, always-on stat modifiers.

No triggers.

No actives.

No more/less.

No additional projectiles.

Only projectile behavior supported in V1 is pierce (default 0).

Card naming for now is generic IDs:

CARD_DAMAGE_FLAT_1, etc.

Weapon V1: Jack Pistol

Jack is the only playable character in V1.

Weapon base crit is defined per weapon.

Cards modify crit additively.

Weapon baseline values may be placeholders until balancing.

Determinism Requirements

All RNG must be seed-based and deterministic.
This includes:

spread angle randomness

crit rolls

ailment application rolls

RNG must be consumed in stable order for replayability.

Implementation Phases and Deliverables
Phase A — Content + stat keys (no gameplay changes)

Deliver:

combat_mods/content/cards/starterCards.ts

combat_mods/content/weapons/jackPistol.ts

combat_mods/stats/statKeys.ts

combat_mods/stats/modifierTypes.ts

combat_mods/stats/combatStatsResolver.ts

Validation:

typecheck passes

debug dump of resolved stats works (dev-only)

Phase B — Weapon autofire (reuse existing projectile movement)

Deliver:

combat_mods/systems/weaponAutoFireSystem.ts

combat_mods/weaponTargeting.ts

Validation:

pistol fires automatically in run

projectiles spawn and move

Phase C — Hit resolution + damage pipeline

Deliver:

combat_mods/damage/damagePipeline.ts

combat_mods/damage/projectileHitResolution.ts

conversion tests

Validation:

damage dealt matches expected math

conversion “remaining pool” behavior proven by tests

Phase D — Ailment application + ticking

Deliver:

combat_mods/ailments/ailmentApplication.ts

combat_mods/systems/ailmentTickSystem.ts

ignite strongest-only logic

caps enforced

Validation:

debug overlay shows stacks and DPS per enemy

poison/bleed stack, ignite replaces if stronger

Phase E — Card gain plumbing (minimal observer hook)

Deliver:

combat_mods/rewards/cardGranting.ts (debug first)

optional reuse of existing UI for choice selection (not XP-coupled)

Validation:

picking a card immediately changes resolved stats

Non-Goals for V1 (explicitly out of scope)

multiple weapons or weapon slots

reload / mana

fork / chain / bounce

triggers / “on kill” explosions

active items / flasks

armor as a mechanic (even if schema exists)

mod tiers / rarity affecting mod rolls (rarity = drop weight only)

Definition of Done (V1)

Jack pistol runs entirely on modifier-based combat.

Starter cards can be granted and modify the pistol.

Damage conversion and ailments behave as specified.

Legacy combat is not active when modifier combat is enabled.

Deterministic runs: same seed → same outcomes.

Notes on Future Extensions (not implemented now)

introduce relic triggers (onHit/onKill/etc.)

enable more/less in relics and high-tier cards

add reload (weapon-specific) while keeping VS-like core

add fork/chain/bounce + additional projectiles

add enemy resist variety and armor formula later

Progress Snapshot

Phase A status: complete

Completed deliverables:

combat_mods/content/cards/starterCards.ts

combat_mods/content/weapons/jackPistol.ts

combat_mods/stats/statKeys.ts

combat_mods/stats/modifierTypes.ts

combat_mods/stats/combatStatsResolver.ts

combat_mods/damage/conversion.ts

combat_mods/index.ts

Phase A validation completed:

typecheck passes

conversion tests pass

combatStatsResolver tests pass

starterCards invariant tests pass

dev debug hook implemented for card grant + resolved pistol stat print

Phase B status: complete

Phase B deliverables completed:

typed projectile payload fields added to world and spawn path:

prDmgPhys

prDmgFire

prDmgChaos

prCritChance

prCritMulti

combatSystem now resolves Jack pistol stats from combat_mods resolver and uses:

shotsPerSecond-driven cooldown

deterministic spread

typed projectile damage payloads

projectile-side crit payloads

collision damage now consumes typed payload + projectile crit fields

legacy world crit fields are no longer used for pistol projectile hit resolution

Phase B tests added:

combat_mods/runtime/spread.test.ts

combat_mods/runtime/critDamagePacket.test.ts

systems/sim/combat.integration_pistol.test.ts

Phase B validation completed:

typecheck passes

all tests pass

Progress update:

[x] Pause Build panel wired to Combat Mods snapshot

[x] Pause menu expanded layout
