# Combat Mods / Stat Resolution / Loadout Effects

## Purpose

- Own the typed combat-rules layer that turns weapon definitions, starter loadout modifiers, relic ownership, and reward choices into resolved combat stats and persistent loadout state.
- Define how hit stats, crit behavior, DOT scalars, ailment application inputs, and relic-backed passive loadout effects are derived before the simulation consumes them.

## Scope

- Combat stat vocabulary and modifier types in:
  - `src/game/combat_mods/stats/statKeys.ts`
  - `src/game/combat_mods/stats/modifierTypes.ts`
- Weapon stat and DOT stat resolution in:
  - `src/game/combat_mods/stats/combatStatsResolver.ts`
  - `src/game/combat_mods/damage/conversion.ts`
  - `src/game/combat_mods/runtime/critDamagePacket.ts`
  - `src/game/combat_mods/runtime/spread.ts`
- Starter combat loadout content lookup in:
  - `src/game/combat_mods/content/weapons/characterStarterMap.ts`
  - `src/game/combat_mods/content/weapons/characterStarterMods.ts`
  - `src/game/combat_mods/content/weapons/starterWeapons.ts`
- Ailment state, application, and tick rules in:
  - `src/game/combat_mods/ailments/ailmentTypes.ts`
  - `src/game/combat_mods/ailments/enemyAilments.ts`
  - `src/game/combat_mods/ailments/applyAilmentsFromHit.ts`
  - `src/game/combat_mods/systems/ailmentTickSystem.ts`
- Relic reward option generation and reward-state mutation in:
  - `src/game/combat_mods/rewards/relicRewardGenerator.ts`
  - `src/game/combat_mods/rewards/relicRewardFlow.ts`
- World relic normalization, starter-relic install, and relic-derived stat rebuild in:
  - `src/game/systems/progression/relics.ts`
  - `src/game/systems/progression/starterRelics.ts`
  - `src/game/stats/derivedStats.ts`
  - `src/game/stats/playerStatPipeline.ts`
- Top-level character/loadout hookup in `src/game/game.ts`

## Non-scope

- Projectile movement, collision broadphase, and enemy death finalization, except where those systems consume resolved combat-mod outputs
- Enemy AI, spawn pacing, boss abilities, and objective progression
- UI menus and build-stat display, except as downstream readers of resolved loadout state
- Item authoring and item `apply(...)` behavior; this system only consumes item effects inside `recomputeDerivedStats(...)`
- Active relic trigger execution such as on-hit/on-kill proc sidecars; those run in the gameplay/progression systems that consume owned relic ids

## Key Entrypoints

- `src/game/combat_mods/stats/combatStatsResolver.ts`
- `src/game/combat_mods/damage/conversion.ts`
- `src/game/combat_mods/runtime/critDamagePacket.ts`
- `src/game/combat_mods/content/weapons/characterStarterMap.ts`
- `src/game/combat_mods/content/weapons/characterStarterMods.ts`
- `src/game/combat_mods/content/weapons/starterWeapons.ts`
- `src/game/combat_mods/ailments/applyAilmentsFromHit.ts`
- `src/game/combat_mods/ailments/enemyAilments.ts`
- `src/game/combat_mods/systems/ailmentTickSystem.ts`
- `src/game/combat_mods/rewards/relicRewardFlow.ts`
- `src/game/combat_mods/rewards/relicRewardGenerator.ts`
- `src/game/systems/progression/relics.ts`
- `src/game/systems/progression/starterRelics.ts`
- `src/game/stats/derivedStats.ts`
- `src/game/game.ts`
- `src/game/systems/sim/combat.ts`
- `src/game/systems/sim/collisions.ts`
- `src/game/systems/sim/beamCombat.ts`

## Data Flow / Pipeline

1. **Character Start -> Starter Loadout Installation**
   - `game.ts` sets `currentCharacterId` when a run, deterministic run, or sandbox run begins.
   - `ensureStarterRelicForCharacter(...)` installs exactly one starter relic for that character with `source: "starter"` and `isLocked: true`.
   - Runtime weapon selection stays character-based through:
     - `resolveCombatStarterWeaponId(...)`
     - `getCombatStarterWeaponById(...)`
     - `resolveCombatStarterStatMods(...)`

2. **Weapon Stat Resolution**
   - `resolveWeaponStats(...)` is the typed weapon-stat resolver for starter weapon defs plus `StatMod[]`.
   - It groups modifiers by `StatKey`, accumulates them by operation bucket, and resolves scalar stats with:
     - `(base + add) * (1 + inc) * more * less`
   - Damage resolution order is:
     - base weapon damage
     - flat damage adds
     - conversion via `applyConversionPriorityFill(...)`
     - generic damage increased/more scaling
   - Crit is not applied here; the resolver outputs pre-crit damage plus crit chance/multi.

3. **Relic Ownership Normalization and Derived Global Stat Rebuild**
   - `normalizeWorldRelics(...)` keeps `world.relics` and `world.relicInstances` canonicalized, deduplicated, and source-aware.
   - `applyRelic(...)`, `removeRelic(...)`, and `setWorldRelicInstances(...)` are the write paths for owned relic state.
   - These mutation paths prime defaults and call `recomputeDerivedStats(...)`.
   - `game.ts` also calls `recomputeDerivedStats(world)` every `RUN` frame, so derived global combat stats are rebuilt continuously from:
     - item effects
     - passive relic effects
     - current momentum / HP context
   - `recomputeDerivedStats(...)` writes the global outputs that combat consumers use:
     - `w.dmgMult`
     - `w.fireRateMult`
     - `w.pSpeed`
     - `w.playerHpMax`
     - `w.maxArmor`
     - `w.momentumMax`

4. **Live Firing Path**
   - `combatSystem(...)` resolves the current starter weapon plus starter stat mods into `ResolvedWeaponStats`.
   - It then applies world/global sidecars outside the resolver:
     - `w.dmgMult`
     - `w.fireRateMult`
     - debug damage/fire-rate multipliers
     - momentum full-crit doubling
     - starter relic effects such as Lucky Chamber
   - Projectile shots serialize typed hit payload into projectile arrays:
     - physical / fire / chaos damage components
     - crit chance / crit multi
     - ailment chances
     - hit `damageMeta`
   - Beam weapons reuse the same resolved weapon base damage, then convert it into beam DPS payload for `beamCombat.ts`.

5. **Hit Resolution and Ailment Application**
   - `collisionsSystem(...)` reads the typed projectile packet and resolves crit through:
     - `resolveCritRoll01(...)`
     - `resolveProjectileDamagePacket(...)`
   - The crit-roll policy can be modified by owned relic state through `getRelicMods(...).critRolls`.
   - Starter relic sidecars then modify the dealt hit payload in the collision path:
     - contaminated rounds
     - point blank carnage
     - thermal starter
   - `applyAilmentsFromHit(...)` derives bleed / ignite / poison stacks from the already-resolved dealt damage bundle and ailment chances.
   - Extra poison payloads can be added on hit, but global hit multipliers are not reapplied inside ailment creation.

6. **DOT / Ailment Tick Path**
   - `enemyAilments.ts` owns stacked poison / bleed / ignite state, duration countdown, and stack-cap behavior.
   - `ailmentTickSystem(...)` advances fixed-rate DOT ticks, applies resist + damage-reduction mitigation, emits DOT `ENEMY_HIT` events, and finalizes deaths.
   - `beamCombat.ts` uses the same DOT-side scalar model for continuous beam damage.
   - Important current behavior:
     - live DOT consumers call `resolveDotStats({ mods: [] })`
     - passive DOT relic scaling is applied manually from owned relic ids
     - starter/loadout `StatMod` DOT keys exist in the rules layer, but they are not currently threaded into the live runtime loadout

7. **Reward -> Relic Acquisition**
   - `generateRelicRewardOptions(...)` samples from enabled, non-starter, not-yet-owned relic ids.
   - `beginRelicReward(...)` writes `world.relicReward = { active, source, options }`.
   - `chooseRelicReward(...)` validates the chosen id against the active option list, canonicalizes it, and routes acquisition through `applyRelic(...)`.
   - Vendor relic purchases also route through `applyRelic(...)`, so reward flow and shop flow share the same owned-relic mutation contract.

## Core Invariants

- `StatKey` plus `ModOp` are the canonical vocabulary for typed combat stat modifiers.
- `resolveWeaponStats(...)` resolves pre-crit weapon output only; crit application happens later in `resolveProjectileDamagePacket(...)`.
- Damage conversion must preserve total damage and must run before generic damage increased/more scaling.
- `resolveWeaponStats(...)` only knows about weapon defs plus explicit `StatMod[]`; world-level relic/item/debug multipliers are applied outside the resolver.
- `world.relics` and `world.relicInstances` must remain normalized views of the same owned-relic set.
- Starter relic instances must remain `source: "starter"` and locked.
- `applyRelic(...)` / `removeRelic(...)` / `setWorldRelicInstances(...)` are the mutation boundary for owned relic state; they are responsible for normalization and derived-stat recompute.
- `recomputeDerivedStats(...)` is the authority for passive world-level outputs such as `w.dmgMult`, `w.fireRateMult`, `w.playerHpMax`, and `w.maxArmor`.
- Ailment stacks are capped at `20`, with authored base durations:
  - ignite: `4s`
  - poison: `2s`
  - bleed: `6s`
- Ailment damage is derived from resolved hit damage at application time, then mitigated at tick time.
- Reward options must exclude disabled relics, starter relics, and already owned relic ids.
- Current live runtime threads starter stat mods into hit stat resolution, but not into `resolveDotStats(...)`; DOT stat-key support is broader than the currently wired runtime path.

## Design Constraints

- New combat stats must be introduced through the typed stat pipeline:
  - add a `STAT_KEYS` entry
  - define how the resolver applies it
  - update every live consumer that needs the resolved output
- New owned-relic mutation paths must route through `applyRelic(...)`, `removeRelic(...)`, or `setWorldRelicInstances(...)`. Direct writes to `world.relics` are not a valid loadout update path.
- Starter weapon, starter stat mods, and starter relics must stay character-driven through the existing mapping helpers. Hard-coding per-character loadout behavior in unrelated systems is drift.
- Damage conversion rules must remain centralized in `applyConversionPriorityFill(...)`; reimplementing conversion in hit consumers creates divergence.
- Ailment creation must continue to use already resolved dealt damage. Reapplying global hit multipliers during DOT creation is a bug.
- If loadout `StatMod` DOT keys need to affect live gameplay, the same non-empty loadout must be threaded consistently into all DOT consumers (`collisions.ts`, `beamCombat.ts`, `ailmentTickSystem.ts`) rather than patched in one place.
- Reward choice application must continue to validate against `world.relicReward.options` before mutating owned relic state.

## Dependencies (In/Out)

### Incoming

- Character selection and run-start flow from `src/game/game.ts`
- World state, projectile arrays, and enemy ailment storage from `src/engine/world/world.ts`
- Relic definitions and canonicalization helpers from `src/game/content/relics.ts`
- Starter relic mapping from `src/game/content/starterRelics.ts`
- Playable-character ids from `src/game/content/playableCharacters.ts`
- Item definitions via `registry.item(...).apply(...)` in `src/game/content/registry.ts`
- Reward-ticket opening from `src/game/systems/progression/rewardPresenterSystem.ts`

### Outgoing

- Resolved weapon stats consumed by:
  - `src/game/systems/sim/combat.ts`
  - `src/ui/pause/pauseMenu.ts`
- Resolved crit / ailment / DOT behavior consumed by:
  - `src/game/systems/sim/collisions.ts`
  - `src/game/systems/sim/beamCombat.ts`
  - `src/game/combat/dot/dotTickSystem.ts`
- Owned relic state and derived globals consumed broadly by:
  - combat runtime
  - movement and armor systems
  - vendor/reward flows
  - pause/build-stat UI
- Reward option state consumed by:
  - reward presentation
  - reward UI
  - `game.ts` reward selection callbacks

## Extension Points

- Add a new starter weapon or character weapon mapping in:
  - `characterStarterMap.ts`
  - `starterWeapons.ts`
  - the authored weapon-def file
- Add a new starter stat-mod package in `characterStarterMods.ts`
- Add a new typed combat modifier by extending:
  - `STAT_KEYS`
  - `StatMod` usage in the resolver
  - the live hit / DOT consumer that should honor it
- Add a new relic reward source by extending:
  - `RelicRewardSource`
  - reward-ticket producers / presenters
- Add a new passive relic effect by extending the correct passive bridge:
  - `getRelicMods(...)`
  - `recomputeDerivedStats(...)`
  - or the specific live combat consumer if the effect is intentionally situational
- Add a new ailment kind only by extending ailment types, stack storage, application, and ticking together

## Failure Modes / Common Mistakes

- Assuming `resolveWeaponStats(...)` already includes relic-derived `w.dmgMult`, `w.fireRateMult`, debug multipliers, or starter relic sidecars is incorrect.
- Adding passive relic content in `content/relics.ts` without updating `getRelicMods(...)`, `recomputeDerivedStats(...)`, or the relevant live consumer leaves the relic inert.
- Writing relic ids directly into `world.relics` or `world.relicInstances` bypasses canonicalization, lock handling, and derived-stat recompute.
- Treating starter relics like removable normal drops breaks the starter-loadout contract.
- Adding DOT stat mods and only updating `resolveDotStats(...)` is incomplete; the live runtime currently passes an empty loadout to DOT consumers.
- Patching poison conversion only in `damageToPoisonConversion.ts` is not enough for the current projectile path; live hit ailment application flows through `applyAilmentsFromHit(...)`.
- Generating reward options or purchases that bypass `applyRelic(...)` can leave owned relic state and derived stats out of sync.
- Recomputing crit or conversion ad hoc in collision code instead of using the typed helpers risks drift from the canonical stat pipeline.

## Verification Status

- Status: `Verified`
- Inferred items: none

## Last Reviewed

- `2026-04-08`
