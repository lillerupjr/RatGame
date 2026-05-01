# Combat Mods / Stat Resolution / Loadout Effects

## Purpose

Own the typed combat-rules layer that turns weapon definitions, starter loadouts, ring progression runtime effects, and reward choices into resolved hit stats, crit behavior, DOT scalars, ailment inputs, passive globals, and persistent loadout state.

## Scope

- Stat vocabulary/modifier types: `src/game/combat_mods/stats/statKeys.ts`, `modifierTypes.ts`
- Weapon/DOT stat resolution: `src/game/combat_mods/stats/combatStatsResolver.ts`, `damage/conversion.ts`, `runtime/critDamagePacket.ts`, `runtime/spread.ts`
- Starter weapon lookup: `content/weapons/characterStarterMap.ts`, `starterWeapons.ts`
- Ailment state/application/ticks: `ailments/ailmentTypes.ts`, `enemyAilments.ts`, `applyAilmentsFromHit.ts`, `systems/ailmentTickSystem.ts`
- Ring progression effects/stat collection: `src/game/progression/effects/*`, `src/game/progression/rings/ringEffects.ts`, `src/game/stats/derivedStats.ts`, `playerStatPipeline.ts`
- Progression reward option application is owned by `src/game/progression/rewards/progressionRewardFlow.ts`
- Character/loadout hookup in `src/game/game.ts`

## Non-scope

- Projectile movement, broadphase, collision timing, death finalization: `docs/canonical/core_simulation_combat_runtime.md`
- Enemy AI/spawn and boss abilities: `docs/canonical/hostile_ai_spawn_runtime.md`, `docs/canonical/boss_encounter_system.md`
- Objective/reward scheduling beyond opening/applying progression rewards: `docs/canonical/progression_objectives_rewards.md`
- UI display of resolved build stats: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Item authoring and `apply(...)` internals; this system consumes item effects in `recomputeDerivedStats(...)`
- Active ring trigger execution sidecars outside passive/stat bridges

## Entrypoints

- `src/game/combat_mods/stats/combatStatsResolver.ts`
- `src/game/combat_mods/damage/conversion.ts`
- `src/game/combat_mods/runtime/critDamagePacket.ts`
- `src/game/combat_mods/content/weapons/characterStarterMap.ts`
- `src/game/combat_mods/content/weapons/starterWeapons.ts`
- `src/game/combat_mods/ailments/applyAilmentsFromHit.ts`
- `src/game/combat_mods/ailments/enemyAilments.ts`
- `src/game/combat_mods/systems/ailmentTickSystem.ts`
- `src/game/progression/effects/effectTypes.ts`
- `src/game/progression/effects/statMods.ts`
- `src/game/progression/effects/worldEffects.ts`
- `src/game/progression/effects/triggeredEffects.ts`
- `src/game/progression/rings/ringEffects.ts`
- `src/game/stats/derivedStats.ts`
- `src/game/game.ts`
- `src/game/systems/sim/combat.ts`
- `src/game/systems/sim/collisions.ts`
- `src/game/systems/sim/beamCombat.ts`

## Pipeline

1. **Starter Loadout**: run start sets `currentCharacterId`; starter weapon lookup resolves through `resolveCombatStarterWeaponId(...)` and `getCombatStarterWeaponById(...)`. Starter ring installation is owned by ring progression (`equipStarterRingForCharacter(...)`) and contributes runtime effects through the same ring-effect path as other rings.
2. **Weapon Stats**: `resolveWeaponStats(...)` groups `StatMod[]` by `StatKey`, resolves `(base + add) * (1 + inc) * more * less`, applies base weapon damage, flat adds, `applyConversionPriorityFill(...)`, then generic damage increased/more scaling. Output is pre-crit damage plus crit chance/multi.
3. **Ring Effects / Globals**: `ensureRingProgressionState(...)` normalizes hand, slot, ring-instance, and stored-token state. Ring definitions and unlocked ring talent nodes produce `RuntimeEffect[]`; `collectWorldStatMods(...)` turns those effects into typed stat mods. `recomputeDerivedStats(...)` runs after ring/effect mutations and every `RUN` frame, producing `w.dmgMult`, `w.fireRateMult`, `w.pSpeed`, `w.playerHpMax`, `w.maxArmor`, and `w.momentumMax` from item effects, ring progression effects, and HP/momentum context.
4. **Live Firing**: `combatSystem(...)` resolves current starter weapon/stat mods, then applies sidecars outside the resolver: `w.dmgMult`, `w.fireRateMult`, debug multipliers, momentum full-crit doubling, starter effects such as Lucky Chamber. Projectiles serialize damage components, crit, ailments, and `damageMeta`; beam weapons reuse base damage as beam DPS payload.
5. **Hit / Ailments**: `collisionsSystem(...)` resolves crit with `resolveCritRoll01(...)` and `resolveProjectileDamagePacket(...)`. Ring-trigger sidecars can alter dealt hit payload through the centralized progression trigger/effect path. `applyAilmentsFromHit(...)` derives bleed/ignite/poison stacks from resolved dealt damage plus ailment chances; extra poison payloads may be added, but global hit multipliers are not reapplied.
6. **DOT Path**: `enemyAilments.ts` owns stacked poison/bleed/ignite duration and caps. `ailmentTickSystem(...)` fixed-ticks DOT with resist/damage reduction, emits DOT `ENEMY_HIT`, and finalizes deaths; `beamCombat.ts` uses the same scalar model. Live DOT consumers currently call `resolveDotStats({ mods: [] })`; DOT `StatMod` keys are defined but not fully threaded into live runtime.
7. **Reward -> Progression Option**: `generateProgressionOffers(...)` produces typed ring, ring-modifier-token, or hand-effect options. `beginProgressionReward(...)` writes active options; `chooseProgressionReward(...)` validates against them and routes acquisition through ring progression write paths. Vendor purchases use `applyProgressionRewardOption(...)`.

## Invariants

- `StatKey` + `ModOp` are the typed stat vocabulary.
- `resolveWeaponStats(...)` is pre-crit and knows only weapon defs plus explicit `StatMod[]`; world ring/item/debug sidecars apply outside.
- Damage conversion preserves total damage and runs before generic increased/more scaling.
- `world.progression` is the ring progression state; ring writes flow through `ringState.ts`: `equipRing(...)`, `unequipRing(...)`, `applyModifierTokenToRing(...)`, `applyHandEffect(...)`.
- Starter rings are installed through `equipStarterRingForCharacter(...)`.
- `recomputeDerivedStats(...)` owns passive world-level outputs such as `w.dmgMult`, `w.fireRateMult`, `w.playerHpMax`, `w.maxArmor`.
- Ailment stacks cap at `20`; base durations: ignite `4s`, poison `2s`, bleed `6s`.
- Ailment damage is derived from resolved hit damage at application, then mitigated at tick time.
- Reward options are typed by `ProgressionRewardFamily`; ring options, modifier tokens, and hand effects apply through the same progression reward flow.

## Constraints

- New combat stats must extend `STAT_KEYS`, resolver behavior, and every live consumer that needs the output.
- Direct writes to `world.progression` bypass normalization, slot occupancy, token handling, and derived-stat recompute.
- Character loadout behavior must stay in starter weapon and starter ring mapping helpers, not unrelated systems.
- Conversion stays centralized in `applyConversionPriorityFill(...)`.
- DOT creation must use already-resolved dealt damage; reapplying global hit multipliers is a bug.
- If loadout DOT keys become live, the same non-empty loadout must reach `collisions.ts`, `beamCombat.ts`, and `ailmentTickSystem.ts`.
- Reward choices/purchases must validate active options before ring progression mutation.

## Dependencies

### Incoming

- Character selection/run start from `src/game/game.ts`
- World state, projectile arrays, enemy ailment storage from `src/engine/world/world.ts`
- Ring definitions and runtime effects from `src/game/progression/rings/ringContent.ts`, `ringState.ts`, and `ringEffects.ts`
- Starter ring mapping from `src/game/progression/rings/characterStarterRingMap.ts`
- Playable-character ids from `src/game/content/playableCharacters.ts`
- Item effects through `registry.item(...).apply(...)`
- Reward-ticket opening from `src/game/systems/progression/rewardPresenterSystem.ts`

### Outgoing

- Weapon stats to `src/game/systems/sim/combat.ts` and `src/ui/pause/pauseMenu.ts`
- Crit/ailment/DOT behavior to `collisions.ts`, `beamCombat.ts`, `src/game/combat/dot/dotTickSystem.ts`
- Ring progression state/derived globals to combat, movement, armor, vendor/reward flows, pause/build-stat UI
- Reward option state to reward presentation/UI and `game.ts` callbacks

## Extension

- Starter weapons/mappings: `characterStarterMap.ts`, `starterWeapons.ts`, authored weapon defs
- Typed modifiers: `STAT_KEYS`, resolver, and live hit/DOT consumers
- Progression reward sources: `ProgressionRewardSource`, ticket producers/presenters
- Passive ring effects: `collectWorldRingRuntimeEffects(...)`, `collectWorldStatMods(...)`, `recomputeDerivedStats(...)`, or a deliberate situational combat consumer
- Ailment kinds: types, stack storage, application, ticking together

## Failure Modes

- Assuming resolver output includes `w.dmgMult`, `w.fireRateMult`, debug multipliers, or starter sidecars is wrong.
- Adding passive ring content without updating runtime-effect collection, `recomputeDerivedStats(...)`, or the live consumer leaves it inert.
- Treating starter rings as removable drops breaks starter loadout.
- Updating only `resolveDotStats(...)` for DOT stat mods is incomplete while live DOT passes empty mods.
- Patching poison conversion only in `damageToPoisonConversion.ts` misses the projectile path through `applyAilmentsFromHit(...)`.
- Bypassing ring progression write helpers desyncs owned state and derived stats.
- Recomputing crit/conversion ad hoc in collision code drifts from the typed pipeline.

## Verification

`Verified`; inferred: none; reviewed `2026-04-08`.
