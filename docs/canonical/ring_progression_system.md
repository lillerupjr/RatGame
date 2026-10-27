# Ring Progression System

## Purpose

Own the ring / hand progression model: ring definitions, ring instances, fixed finger slot topology, runtime effect collection, state normalization, content validation, and the inspection/snapshot boundary consumed by UI and stat resolution.

## Scope

- Ring type vocabulary: `src/game/progression/rings/ringTypes.ts`
- Ring content registry and validation: `src/game/progression/rings/ringContent.ts`
- Ring state management (equip, unequip, normalization): `src/game/progression/rings/ringState.ts`
- Runtime effect collection from ring instances: `src/game/progression/rings/ringEffects.ts`
- Ring inspection (read-only structured view): `src/game/progression/rings/ringInspection.ts`
- Character starter ring mapping: `src/game/progression/rings/characterStarterRingMap.ts`
- Effect type vocabulary: `src/game/progression/effects/effectTypes.ts`
- Stat mod collection from runtime effects: `src/game/progression/effects/statMods.ts`
- World-level effect aggregation: `src/game/progression/effects/worldEffects.ts`
- Reward-rule collection from runtime effects: `src/game/progression/effects/rewardRules.ts`
- Weapon-fire rule collection from runtime effects: `src/game/progression/effects/weaponFireRules.ts`
- Hands screen data bridge (snapshot builder, stats preview): `src/ui/pixi/hands/handsDataBridge.ts`
- Hands screen UI state machine: `src/ui/pixi/hands/handsState.ts`
- Hands screen PixiJS rendering: `src/ui/pixi/hands/handsScreen.ts`
- Hands screen sub-components: `src/ui/pixi/hands/detailDrawer.ts`, `statsRail.ts`, `ringSlot.ts`, `ringSlotConfig.ts`

## Non-scope

- Stat resolution pipeline that consumes ring stat mods: `docs/canonical/combat_mods_stat_resolution_loadout_effects.md`
- Reward scheduling, ticket lifecycle, and progression offer generation: `docs/canonical/progression_objectives_rewards.md`
- UI shell visibility, mounting, and callback wiring: `docs/canonical/ui_shell_menus_runtime_panels.md`
- Triggered effect execution in combat: `docs/canonical/core_simulation_combat_runtime.md`
- Ailment application from ring combat rules: `docs/canonical/combat_mods_stat_resolution_loadout_effects.md`

## Entrypoints

- `src/game/progression/rings/ringTypes.ts`
- `src/game/progression/rings/ringContent.ts`
- `src/game/progression/rings/ringState.ts`
- `src/game/progression/rings/ringEffects.ts`
- `src/game/progression/rings/ringInspection.ts`
- `src/game/progression/rings/characterStarterRingMap.ts`
- `src/game/progression/effects/effectTypes.ts`
- `src/game/progression/effects/statMods.ts`
- `src/game/progression/effects/worldEffects.ts`
- `src/game/progression/effects/rewardRules.ts`
- `src/game/progression/effects/weaponFireRules.ts`
- `src/ui/pixi/hands/handsDataBridge.ts`
- `src/ui/pixi/hands/handsScreen.ts`
- `src/ui/pixi/hands/handsState.ts`

## Pipeline

1. **Content Registration**: `ringContent.ts` defines `RING_DEFS_V1` (all authored ring definitions). `createRingContentIndex(...)` validates content at module load and builds lookup maps. `validateRingContent(...)` checks for duplicate ids, unknown families, invalid authored tiers (`t0`, `t1`, `t2`, `t3` only), invalid effect defs, and invalid trigger keys. Lookup API: `getRingDefById(...)`, `getAllRingDefs()`.

2. **State Initialization / Normalization**: `createInitialRingProgressionState()` produces a clean state with two hands (4 fingers each), empty ring map, and `nextRingInstanceSeq = 1`. `ensureRingProgressionState(world)` normalizes `world.progression` on every access: rebuilds both hands at exactly 4 fingers each, validates ring instances (discards unknown defs, invalid slots, duplicate occupancy; rebuilds each instance as `{ instanceId, defId, slotId }`), and reconciles `nextRingInstanceSeq`. Normalization is idempotent and defensive against malformed save state.

3. **Ring Equip / Unequip**: `equipRing(world, defId, preferredSlotId?)` validates the ring def and slot, replaces any existing ring in the slot (deleting the old instance), creates a new `RingInstance` with sequential id, and sets slot ownership. `unequipRing(world, slotId)` removes the ring instance from the slot without replacement. `canEquipRing(...)` validates without mutation. `resolveRingEquipTargetSlotId(...)` resolves a preferred slot or falls back to first empty then first slot.

4. **Runtime Effect Collection**: `collectRingRuntimeEffects(state)` iterates all ring instances, emitting a `RuntimeEffect` for each ring's `mainEffect` (with `increasedEffectScalar = 0` before neighbor resolution). Each effect carries an `EffectSourceRef` with `kind` (`RING_MAIN`), instance id, def id, and slot id. `collectWorldRingRuntimeEffects(world)` wraps this for world access. `collectWorldRingStatMods(world)` extracts static typed `StatMod[]` from the runtime effects. `collectWorldRingFamilyCounts(world)` counts equipped ring families for family-scaling combat rules. `collectWorldStatMods(world)` in `worldEffects.ts` aggregates static and dynamic ring effects into the final stat mod array consumed by stat resolution.

5. **Stat Mod Scaling**: `collectStatModsFromRuntimeEffects(...)` in `statMods.ts` applies the `increasedEffectScalar` from each `RuntimeEffect` to `STAT_MODIFIERS` effects: `mod.value * (1 + scalar)`. `collectDynamicStatModsFromRuntimeEffects(...)` in `worldEffects.ts` applies the same scalar to `DYNAMIC_STAT_MODIFIERS` generated from world state such as maximum life and missing life. This means neighbor amplification multiplicatively scales authored numeric modifier values on the ring's main effect.

6. **Floor Lifecycle Effects**: `applyFloorLifecycleEffects(world, "FLOOR_COMPLETE")` in `floorLifecycleEffects.ts` consumes `FLOOR_LIFECYCLE` runtime effects after the floor-clear commit path succeeds. Floor lifecycle effects are ring-owned runtime effects; floor completion detection remains owned by `game.ts` and run progression state.

7. **Reward Rules**: `collectWorldRewardRules(world)` in `rewardRules.ts` consumes `REWARD_RULES` runtime effects for active progression reward generation. Reward rules can add ring reward options, bias ring reward candidates toward equipped families, and grant floor-completion ring reward rerolls. Vendor inventory generation stays on the base reward generator.

8. **Weapon Fire Rules**: `collectWorldWeaponFireRules(world)` in `weaponFireRules.ts` consumes `WEAPON_FIRE_RULES` runtime effects for player weapon-fire sidecars. Current rules can add one backfire projectile per projectile firing cycle while keeping beam weapons and base weapon stat resolution separate.

9. **Inspection**: `inspectRingProgressionState(state)` / `inspectWorldRingProgression(world)` returns a read-only structured view: hands and per-ring entries with instance, slot, ring name, family id, main effect scalar, and filtered runtime effects. This is the primary read surface for UI data bridges.

10. **Hands Screen Data Bridge**: `buildHandsScreenSnapshot(world, pendingRingDefId?)` in `handsDataBridge.ts` transforms the inspection into a flat UI snapshot: per-slot data (equipped state, ring name, stat mods as strings, family color), resolved weapon stats, equipped count, and pending ring def (for choose-slot mode). `computeStatsPreviewDelta(world, slotId, ringDefId)` computes a "what-if" stat delta by deep-cloning the ring progression state, temporarily equipping the pending ring, resolving weapon stats from the clone, and returning the difference from current stats. This avoids world mutation for hover previews.

11. **Hands Screen State Machine**: `handsState.ts` defines a typed state machine with modes `browse`, `selected`, and `choose-slot`. Actions: `SELECT_SLOT`, `DESELECT`, `CONFIRM_SLOT`, `CANCEL`, `UNEQUIP_RING`. Transitions are pure functions; the screen reads mode + selectedSlotId to drive rendering.

12. **Hands Screen Rendering**: `handsScreen.ts` is a PixiJS overlay mounted by `main.ts`. It owns the scene graph (ring slots, stats rail, detail drawer), wires callbacks (`onEquipToSlot`, `onClose`, `onUnequip`, `computeStatsPreview`), and tracks hover state for stats preview in choose-slot mode. `ringSlot.ts` renders individual diamond markers with glow and hover/press interaction. `detailDrawer.ts` renders ring info, replacement warnings, and the unequip action button. `statsRail.ts` renders current weapon stats and optional stat delta indicators.

## Invariants

- `world.progression` is the sole container for ring progression state; all writes flow through `ringState.ts` functions: `equipRing(...)`, `unequipRing(...)`.
- `ensureRingProgressionState(...)` normalizes on every access; callers must not assume raw `world.progression` is well-formed.
- Ring content is validated at module load; invalid content throws. Authored ring tiers use exact strings `t0`, `t1`, `t2`, and `t3`. `getRingDefById(...)` returns `undefined` for unknown ids.
- Ring instances carry only identity and placement (`instanceId`, `defId`, `slotId`); there are no per-ring upgrade tokens, passive points, or talent trees.
- Hand topology is fixed: 4 fingers per hand, 8 slots total. There are no hand structural effects (no add-finger or finger empowerment).
- Slot ids follow format `{HandId}:{index}` (e.g. `LEFT:0`, `RIGHT:3`).
- `nextRingInstanceSeq` is monotonically increasing; instance ids follow format `ring-instance-{seq}`.
- Runtime effects carry source attribution (`RING_MAIN`) for UI and debugging.
- `increasedEffectScalar` on `RuntimeEffect` starts at 0 and is raised only by `AMPLIFY_NEIGHBORS`; stat mods scale by `value * (1 + scalar)`.
- **Neighbor-ring resolution**: `collectRingRuntimeEffects(...)` post-processes structural effects (`AMPLIFY_NEIGHBORS`, `MIRROR_LEFT_RING`) after the initial collect pass. Slot ordering is `LEFT:0..N, RIGHT:0..N`. Amplify runs before Mirror so that mirrored effects include amplification. Structural effects are removed from the output after resolution.
- `AMPLIFY_NEIGHBORS` adds its `increasedEffectBonus` to the `increasedEffectScalar` of immediately adjacent occupied slots' RING_MAIN effects. Does not boost other structural effects (Mirror, Amplify).
- `MIRROR_LEFT_RING` replaces its own effect with a copy of the immediately previous occupied slot's `mainEffect`. Does not copy structural effects (Mirror, Amplify). Produces no effect if there is no copyable left neighbor.
- Hands screen reads from snapshots and fires callbacks; it does not mutate world state directly.
- Stats preview uses a deep clone of ring progression state to avoid world mutation.
- Starter ring equip at run start targets `LEFT:0` through `equipStarterRingForCharacter(...)`.

## Constraints

- New ring content must be added to `RING_DEFS_V1` and pass `validateRingContent(...)`.
- New ring families must be added to `RING_FAMILY_IDS`.
- New effect kinds must extend `EffectDef` union, `validateEffectDef(...)`, and all relevant consumers (stat collection, triggered effect dispatch, combat rule snapshot, lifecycle hooks, reward rules, or weapon-fire rules).
- Direct writes to `world.progression` bypass normalization, slot occupancy, and derived-stat recompute.
- After any ring state mutation, `recomputeDerivedStats(world)` must run to propagate passive effects to world-level outputs.
- The hands screen data bridge (`handsDataBridge.ts`) lives in the UI layer and must not be imported by game-layer code. `main.ts` is the bridge between layers.

## Dependencies

### Incoming

- World state container (`world.progression`) from `src/engine/world/world.ts`
- Stat key vocabulary from `src/game/combat_mods/stats/statKeys.ts`
- Trigger key vocabulary from `src/game/events.ts`
- Projectile kind vocabulary from `src/game/factories/projectileFactory.ts`
- Playable character ids from `src/game/content/playableCharacters.ts`
- Reward option application from `src/game/progression/rewards/progressionRewardFlow.ts`
- `recomputeDerivedStats(world)` from `src/game/stats/derivedStats.ts`
- Combat mods snapshot for stats preview from `src/game/combat_mods/debug/combatModsSnapshot.ts`
- Starter weapon lookup from `src/game/combat_mods/content/weapons/`

### Outgoing

- `RuntimeEffect[]` to stat collection (`collectWorldStatMods`), triggered effect dispatch, and combat rule snapshot
- `StatMod[]` to stat resolution (`resolveWeaponStats`)
- Ring progression state to reward/vendor option generation
- `HandsScreenSnapshot` to hands screen PixiJS rendering
- `StatDelta` to stats rail for hover previews
- Inspection data to pause menu build stats view

## Extension

- New ring definitions: add to `RING_DEFS_V1`, validate passes automatically
- New ring families: add to `RING_FAMILY_IDS`, add color to `FAMILY_COLORS` in data bridge
- New effect kinds: extend `EffectDef`, `validateEffectDef(...)`, `collectStatModsFromRuntimeEffects(...)` or appropriate consumer
- New structural effect kinds: extend `isStructuralEffectKind(...)` in `ringEffects.ts` and add resolution logic in the amplify/mirror passes of `collectRingRuntimeEffects(...)`
- Hands screen actions: extend `HandsAction` union in `handsState.ts`, add transition case, wire callback in `handsScreen.ts` and `main.ts`

## Failure Modes

- Bypassing `ringState.ts` write functions to mutate `world.progression` directly desyncs slot ownership and derived stats.
- Forgetting `recomputeDerivedStats(world)` after ring mutation leaves passive world outputs stale.
- Equipping a ring to an occupied slot silently replaces the old ring; the old instance is permanently deleted.
- Normalization discards ring instances with unknown def ids; renaming or removing ring defs invalidates existing save state.
- Importing `handsDataBridge.ts` from game-layer code violates the UI shell boundary; `main.ts` must serve as the bridge.
- Stats preview clone does not include non-ring effects (items, debug multipliers); preview deltas reflect ring stat mods only.
- Ring content validation runs at module load; invalid content prevents game startup entirely.

## Verification

`Verified`; inferred: none; reviewed `2026-10-27`.
