import { describe, expect, test } from "vitest";
import { collectWorldCombatRules } from "../effects/combatRules";
import { collectWorldRingStatMods } from "./ringEffects";
import { inspectWorldRingProgression } from "./ringInspection";
import { equipRing, createInitialRingProgressionState } from "./ringState";
import { RING_DEFS_V1 } from "./ringContent";
import type { CombatRulesSnapshot } from "../effects/combatRules";

function stubWorld(): any {
  return {
    progression: createInitialRingProgressionState(),
  };
}

function hasCombatRuleSignal(snapshot: CombatRulesSnapshot): boolean {
  return snapshot.everyNthShotCrits != null
    || snapshot.piercePoisonedTargets
    || snapshot.pierceHitsMoreDamageToPoisoned > 0
    || snapshot.moreDamageToBurningTargets > 0
    || snapshot.pointBlankDamageFalloff != null
    || snapshot.pointBlankCloseHitKnockback != null
    || snapshot.critRollsTwice
    || snapshot.triggeredHitsCanApplyDots
    || snapshot.convertAllHitDamageToChaos
    || snapshot.poisonExtraStackChance > 0
    || snapshot.doubleTriggers
    || snapshot.triggerProcChanceIncreased > 0
    || snapshot.retryFailedTriggerProcsOnce;
}

describe("V1 ring catalog smoke coverage", () => {
  test.each(RING_DEFS_V1.map((def) => [def.id]))("surfaces %s through ring runtime inspection", (ringDefId) => {
    const world = stubWorld();
    const def = RING_DEFS_V1.find((candidate) => candidate.id === ringDefId);
    expect(def).toBeDefined();

    const instance = equipRing(world, ringDefId, "LEFT:0");
    const inspection = inspectWorldRingProgression(world);

    expect(inspection.rings).toHaveLength(1);
    expect(inspection.rings[0]).toMatchObject({
      ringName: def!.name,
      familyId: def!.familyId,
      instance: {
        instanceId: instance.instanceId,
        defId: ringDefId,
        slotId: "LEFT:0",
      },
    });
    expect(inspection.rings[0].runtimeEffects).toHaveLength(1);
    expect(inspection.rings[0].runtimeEffects[0].effect).toEqual(def!.mainEffect);

    if (def!.mainEffect.kind === "STAT_MODIFIERS") {
      expect(collectWorldRingStatMods(world)).toEqual(expect.arrayContaining(def!.mainEffect.mods));
    } else if (def!.mainEffect.kind === "COMBAT_RULES") {
      expect(hasCombatRuleSignal(collectWorldCombatRules(world))).toBe(true);
    } else if (def!.mainEffect.kind === "TRIGGERED") {
      expect(inspection.rings[0].runtimeEffects[0].effect).toMatchObject({
        kind: "TRIGGERED",
        triggerKey: def!.mainEffect.triggerKey,
        action: { kind: def!.mainEffect.action.kind },
      });
    }
  });
});
