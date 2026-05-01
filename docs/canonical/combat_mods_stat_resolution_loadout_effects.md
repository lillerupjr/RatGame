# Combat Mods / Stat Resolution / Loadout Effects

## Purpose

Own the typed combat-rules layer that turns weapon definitions, starter loadouts, relic ownership, and reward choices into resolved hit stats, crit behavior, DOT scalars, ailment inputs, passive globals, and persistent loadout state.

## Scope

- Stat vocabulary/modifier types: `src/game/combat_mods/stats/statKeys.ts`, `modifierTypes.ts`
- Weapon/DOT stat resolution: `src/game/combat_mods/stats/combatStatsResolver.ts`, `damage/conversion.ts`, `runtime/critDamagePacket.ts`, `runtime/spread.ts`
- Starter loadout lookup: `content/weapons/characterStarterMap.ts`, `characterStarterMods.ts`, `starterWeapons.ts`
- Ailment state/application/ticks: `ailments/ailmentTypes.ts`, `enemyAilments.ts`, `applyAilmentsFromHit.ts`, `systems/ailmentTickSystem.ts`
- Relic reward options/state: `rewards/relicRewardGenerator.ts`, `rewards/relicRewardFlow.ts`
- Relic normalization/starter install/derived stat rebuild: `src/game/systems/progression/relics.ts`, `starterRelics.ts`, `src/game/stats/derivedStats.ts`, `playerStatPipeline.ts`
- Character/loadout hookup in `src/game/game.ts`

## Non-scope

- Projectile movement, broadphase, collision timing, death finalization: `docs/canonical/core_simulation_combat_runtime.md`
- Enemy AI/spawn and boss abilities: `docs/canonical/hostile_ai_spawn_runtime.md`, `docs/canonical/boss_encounter_system.md`
- Objective/reward scheduling beyond opening/applying relic rewards: `docs/canonical/progression_objectives_rewards.md`
- UI display of resolved build stats: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Item authoring and `apply(...)` internals; this system consumes item effects in `recomputeDerivedStats(...)`
- Active relic trigger execution sidecars outside passive/stat bridges

## Entrypoints

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

## Pipeline

1. **Starter Loadout**: run start sets `currentCharacterId`; `ensureStarterRelicForCharacter(...)` installs exactly one locked `source: "starter"` relic. Runtime weapon/stat mods resolve through `resolveCombatStarterWeaponId(...)`, `getCombatStarterWeaponById(...)`, and `resolveCombatStarterStatMods(...)`.
2. **Weapon Stats**: `resolveWeaponStats(...)` groups `StatMod[]` by `StatKey`, resolves `(base + add) * (1 + inc) * more * less`, applies base weapon damage, flat adds, `applyConversionPriorityFill(...)`, then generic damage increased/more scaling. Output is pre-crit damage plus crit chance/multi.
3. **Owned Relics / Globals**: `normalizeWorldRelics(...)` keeps `world.relics` and `world.relicInstances` canonicalized, deduped, and source-aware. `applyRelic(...)`, `removeRelic(...)`, and `setWorldRelicInstances(...)` are write paths; they prime defaults and call `recomputeDerivedStats(...)`. `game.ts` also recomputes every `RUN` frame, producing `w.dmgMult`, `w.fireRateMult`, `w.pSpeed`, `w.playerHpMax`, `w.maxArmor`, `w.momentumMax` from items, passive relics, HP/momentum context.
4. **Live Firing**: `combatSystem(...)` resolves current starter weapon/stat mods, then applies sidecars outside the resolver: `w.dmgMult`, `w.fireRateMult`, debug multipliers, momentum full-crit doubling, starter effects such as Lucky Chamber. Projectiles serialize damage components, crit, ailments, and `damageMeta`; beam weapons reuse base damage as beam DPS payload.
5. **Hit / Ailments**: `collisionsSystem(...)` resolves crit with `resolveCritRoll01(...)` and `resolveProjectileDamagePacket(...)`; `getRelicMods(...).critRolls` can modify policy. Starter sidecars then alter dealt hit payload. `applyAilmentsFromHit(...)` derives bleed/ignite/poison stacks from resolved dealt damage plus ailment chances; extra poison payloads may be added, but global hit multipliers are not reapplied.
6. **DOT Path**: `enemyAilments.ts` owns stacked poison/bleed/ignite duration and caps. `ailmentTickSystem(...)` fixed-ticks DOT with resist/damage reduction, emits DOT `ENEMY_HIT`, and finalizes deaths; `beamCombat.ts` uses the same scalar model. Live DOT consumers currently call `resolveDotStats({ mods: [] })`; passive DOT relic scaling is manual from owned relic ids, and loadout DOT `StatMod` keys are defined but not threaded into live runtime.
7. **Reward -> Relic**: `generateRelicRewardOptions(...)` samples enabled, non-starter, unowned relic ids. `beginRelicReward(...)` writes active options; `chooseRelicReward(...)` validates against them and routes acquisition through `applyRelic(...)`. Vendor purchases also use `applyRelic(...)`.

## Invariants

- `StatKey` + `ModOp` are the typed stat vocabulary.
- `resolveWeaponStats(...)` is pre-crit and knows only weapon defs plus explicit `StatMod[]`; world relic/item/debug sidecars apply outside.
- Damage conversion preserves total damage and runs before generic increased/more scaling.
- `world.relics` and `world.relicInstances` are normalized views of the same owned set.
- Starter relics remain locked and `source: "starter"`.
- Owned-relic mutations use `applyRelic(...)`, `removeRelic(...)`, or `setWorldRelicInstances(...)`.
- `recomputeDerivedStats(...)` owns passive world-level outputs such as `w.dmgMult`, `w.fireRateMult`, `w.playerHpMax`, `w.maxArmor`.
- Ailment stacks cap at `20`; base durations: ignite `4s`, poison `2s`, bleed `6s`.
- Ailment damage is derived from resolved hit damage at application, then mitigated at tick time.
- Reward options exclude disabled relics, starter relics, and already owned relics.
- Starter stat mods affect live hit resolution but not current `resolveDotStats(...)` calls.

## Constraints

- New combat stats must extend `STAT_KEYS`, resolver behavior, and every live consumer that needs the output.
- Direct writes to `world.relics` / `world.relicInstances` bypass normalization, lock handling, and derived-stat recompute.
- Character loadout behavior must stay in starter weapon/stat/relic mapping helpers, not unrelated systems.
- Conversion stays centralized in `applyConversionPriorityFill(...)`.
- DOT creation must use already-resolved dealt damage; reapplying global hit multipliers is a bug.
- If loadout DOT keys become live, the same non-empty loadout must reach `collisions.ts`, `beamCombat.ts`, and `ailmentTickSystem.ts`.
- Reward choices/purchases must validate active options before owned-relic mutation.

## Dependencies

### Incoming

- Character selection/run start from `src/game/game.ts`
- World state, projectile arrays, enemy ailment storage from `src/engine/world/world.ts`
- Relic definitions/canonicalization from `src/game/content/relics.ts`
- Starter relic mapping from `src/game/content/starterRelics.ts`
- Playable-character ids from `src/game/content/playableCharacters.ts`
- Item effects through `registry.item(...).apply(...)`
- Reward-ticket opening from `src/game/systems/progression/rewardPresenterSystem.ts`

### Outgoing

- Weapon stats to `src/game/systems/sim/combat.ts` and `src/ui/pause/pauseMenu.ts`
- Crit/ailment/DOT behavior to `collisions.ts`, `beamCombat.ts`, `src/game/combat/dot/dotTickSystem.ts`
- Owned relic state/derived globals to combat, movement, armor, vendor/reward flows, pause/build-stat UI
- Reward option state to reward presentation/UI and `game.ts` callbacks

## Extension

- Starter weapons/mappings: `characterStarterMap.ts`, `starterWeapons.ts`, authored weapon defs
- Starter stat packages: `characterStarterMods.ts`
- Typed modifiers: `STAT_KEYS`, resolver, and live hit/DOT consumers
- Relic reward sources: `RelicRewardSource`, ticket producers/presenters
- Passive relic effects: `getRelicMods(...)`, `recomputeDerivedStats(...)`, or a deliberate situational combat consumer
- Ailment kinds: types, stack storage, application, ticking together

## Failure Modes

- Assuming resolver output includes `w.dmgMult`, `w.fireRateMult`, debug multipliers, or starter sidecars is wrong.
- Adding passive relic content without updating `getRelicMods(...)`, `recomputeDerivedStats(...)`, or the live consumer leaves it inert.
- Treating starter relics as removable drops breaks starter loadout.
- Updating only `resolveDotStats(...)` for DOT stat mods is incomplete while live DOT passes empty mods.
- Patching poison conversion only in `damageToPoisonConversion.ts` misses the projectile path through `applyAilmentsFromHit(...)`.
- Bypassing `applyRelic(...)` desyncs owned state and derived stats.
- Recomputing crit/conversion ad hoc in collision code drifts from the typed pipeline.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
