import {
  resolveWeaponStats,
  type ResolvedWeaponStats,
} from "../../../game/combat_mods/stats/combatStatsResolver";
import { getCombatModsSnapshot } from "../../../game/combat_mods/debug/combatModsSnapshot";
import { resolveCombatStarterWeaponId } from "../../../game/combat_mods/content/weapons/characterStarterMap";
import { getCombatStarterWeaponById } from "../../../game/combat_mods/content/weapons/starterWeapons";
import { inspectWorldRingProgression } from "../../../game/progression/rings/ringInspection";
import { getRingDefById } from "../../../game/progression/rings/ringContent";
import { ensureRingProgressionState, getFingerSlot } from "../../../game/progression/rings/ringState";
import { collectRingRuntimeEffects } from "../../../game/progression/rings/ringEffects";
import { collectStatMods } from "../../../game/progression/effects/statMods";
import type { FingerSlotId, RingProgressionState } from "../../../game/progression/rings/ringTypes";
import { describeStatMod } from "../../formatters";
import { getFamilyColor } from "../pixiTheme";
import type { StatDelta } from "./statsRail";

export type HandsSlotSnapshot = {
  slotId: FingerSlotId;
  hand: "LEFT" | "RIGHT";
  index: number;
  equipped: boolean;
  ringName: string | null;
  ringDefId: string | null;
  instanceId: string | null;
  familyId: string | null;
  description: string | null;
  statMods: string[];
  familyColor: number;
};

export type PendingRingDef = {
  defId: string;
  name: string;
  familyId: string;
  description: string;
  statMods: string[];
};

export type HandsScreenSnapshot = {
  slots: HandsSlotSnapshot[];
  stats: ResolvedWeaponStats;
  equippedCount: number;
  pendingRingDef: PendingRingDef | null;
};


function extractStatModStrings(runtimeEffects: any[]): string[] {
  const result: string[] = [];
  for (const re of runtimeEffects) {
    const eff = re.effect;
    if (eff?.kind === "STAT_MODIFIERS" && Array.isArray(eff.mods)) {
      for (const mod of eff.mods) {
        result.push(describeStatMod(mod));
      }
    } else if (eff?.kind) {
      result.push(eff.kind);
    }
  }
  return result;
}

export function buildHandsScreenSnapshot(
  world: any,
  pendingRingDefId?: string | null,
): HandsScreenSnapshot {
  const inspection = inspectWorldRingProgression(world);
  const combatSnapshot = getCombatModsSnapshot(world);

  // Build slot snapshots: iterate over all hand slots from inspection
  const slots: HandsSlotSnapshot[] = [];
  for (const handId of ["LEFT", "RIGHT"] as const) {
    const hand = inspection.hands[handId];
    for (const slot of hand.slots) {
      const ringEntry = inspection.rings.find((r) => r.instance.slotId === slot.slotId);
      const def = ringEntry ? getRingDefById(ringEntry.instance.defId) : null;


      slots.push({
        slotId: slot.slotId,
        hand: handId,
        index: slot.index,
        equipped: !!ringEntry,
        ringName: ringEntry?.ringName ?? null,
        ringDefId: ringEntry?.instance.defId ?? null,
        instanceId: ringEntry?.instance.instanceId ?? null,
        familyId: def?.familyId ?? null,
        description: def?.description ?? null,
        statMods: ringEntry ? extractStatModStrings(ringEntry.runtimeEffects) : [],
        familyColor: getFamilyColor(def?.familyId ?? null),
      });
    }
  }

  // Pending ring def
  let pendingRingDef: PendingRingDef | null = null;
  if (pendingRingDefId) {
    const def = getRingDefById(pendingRingDefId);
    if (def) {
      // Get stat mods from the def's main effect
      const mods: string[] = [];
      if (def.mainEffect.kind === "STAT_MODIFIERS" && Array.isArray((def.mainEffect as any).mods)) {
        for (const mod of (def.mainEffect as any).mods) {
          mods.push(describeStatMod(mod));
        }
      } else {
        mods.push(def.mainEffect.kind);
      }

      pendingRingDef = {
        defId: def.id,
        name: def.name,
        familyId: def.familyId,
        description: def.description,
        statMods: mods,
      };
    }
  }

  return {
    slots,
    stats: combatSnapshot.weaponStats,
    equippedCount: slots.filter((s) => s.equipped).length,
    pendingRingDef,
  };
}

/**
 * Compute a stats delta for a hypothetical ring equip without mutating world state.
 * Clones the ring progression state, equips the ring in the clone, resolves weapon
 * stats from the clone's effects, and returns the difference from current stats.
 */
export function computeStatsPreviewDelta(
  world: any,
  slotId: FingerSlotId,
  ringDefId: string,
): StatDelta | null {
  if (!getRingDefById(ringDefId)) return null;

  // Current stats
  const currentSnapshot = getCombatModsSnapshot(world);
  const currentStats = currentSnapshot.weaponStats;

  // Clone the ring progression state
  const realState = ensureRingProgressionState(world);
  const clonedState: RingProgressionState = JSON.parse(JSON.stringify(realState));

  // Equip the pending ring in the cloned state
  const slot = getFingerSlot(clonedState, slotId);
  if (!slot) return null;

  // Remove existing ring in this slot (if any)
  if (slot.ringInstanceId) {
    delete clonedState.ringsByInstanceId[slot.ringInstanceId];
  }

  // Create a temporary instance
  const tempInstanceId = "__preview__";
  clonedState.ringsByInstanceId[tempInstanceId] = {
    instanceId: tempInstanceId,
    defId: ringDefId,
    slotId,
  };
  slot.ringInstanceId = tempInstanceId;

  // Resolve weapon stats from the cloned state
  const clonedEffects = collectRingRuntimeEffects(clonedState);
  const clonedMods = collectStatMods({ runtimeEffects: clonedEffects });
  const starterWeaponId = resolveCombatStarterWeaponId(world?.currentCharacterId);
  const starterWeapon = getCombatStarterWeaponById(starterWeaponId);
  const previewStats = resolveWeaponStats(starterWeapon, { statMods: clonedMods });

  // Compute deltas
  return {
    shotsPerSecond: previewStats.shotsPerSecond - currentStats.shotsPerSecond,
    critChance: previewStats.critChance - currentStats.critChance,
    critMulti: previewStats.critMulti - currentStats.critMulti,
    basePhysical: previewStats.baseDamage.physical - currentStats.baseDamage.physical,
    chanceToPoison: previewStats.chanceToPoison - currentStats.chanceToPoison,
  };
}
