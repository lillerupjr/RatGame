import type { ResolvedWeaponStats } from "../../../game/combat_mods/stats/combatStatsResolver";
import { getCombatModsSnapshot } from "../../../game/combat_mods/debug/combatModsSnapshot";
import { inspectWorldRingProgression } from "../../../game/progression/rings/ringInspection";
import { getRingDefById, getRingFamilyTalentTreeById } from "../../../game/progression/rings/ringContent";
import type { FingerSlotId, StoredModifierTokens } from "../../../game/progression/rings/ringTypes";
import { describeStatMod } from "../../formatters";

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
  allocatedPassivePoints: number;
  availablePassivePoints: number;
  unlockedTalentCount: number;
  totalTalentCount: number;
  empowermentScalar: number;
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
  storedTokens: StoredModifierTokens;
};

const FAMILY_COLORS: Record<string, number> = {
  starter: 0xd4a84a,
  generic: 0xd4a84a,
  physical: 0xcc6644,
  dot: 0x66aa55,
  chaos: 0x9955cc,
  poison: 0x44bb66,
  projectile: 0x5588cc,
  ignite: 0xdd6633,
  crit: 0xdd9933,
  trigger: 0x7777cc,
  defense: 0x6688aa,
  utility: 0x88aa66,
};

function getFamilyColor(familyId: string | null): number {
  return (familyId && FAMILY_COLORS[familyId]) || 0xd4a84a;
}

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
      const tree = def ? getRingFamilyTalentTreeById(def.familyId) : undefined;

      // Compute talent/passive point info
      const allocatedPassivePoints = ringEntry?.instance.allocatedPassivePoints ?? 0;
      const unlockedTalentCount = ringEntry?.unlockedNodes.length ?? 0;
      // spentPassivePoints = sum of costs of unlocked nodes
      let spentPoints = 0;
      if (ringEntry) {
        for (const node of ringEntry.unlockedNodes) {
          spentPoints += node.cost;
        }
      }

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
        allocatedPassivePoints,
        availablePassivePoints: allocatedPassivePoints - spentPoints,
        unlockedTalentCount,
        totalTalentCount: tree?.nodes.length ?? 0,
        empowermentScalar: slot.empowermentScalar,
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
    storedTokens: inspection.storedModifierTokens,
  };
}
