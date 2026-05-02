import { describe, expect, test } from "vitest";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import { collectWorldCombatRules } from "../effects/combatRules";
import { applyFloorLifecycleEffects } from "../effects/floorLifecycleEffects";
import { collectWorldRewardRules, type RewardRulesSnapshot } from "../effects/rewardRules";
import { collectWorldStatMods } from "../effects/worldEffects";
import { collectWorldRingStatMods } from "./ringEffects";
import { inspectWorldRingProgression } from "./ringInspection";
import { equipRing, createInitialRingProgressionState } from "./ringState";
import { RING_DEFS_V1 } from "./ringContent";
import type { CombatRulesSnapshot } from "../effects/combatRules";

function stubWorld(): any {
  return {
    progression: createInitialRingProgressionState(),
    playerHpMax: 100,
    playerHp: 70,
  };
}

function hasCombatRuleSignal(snapshot: CombatRulesSnapshot): boolean {
  return snapshot.everyNthShotCrits != null
    || snapshot.piercePoisonedTargets
    || snapshot.pierceHitsMoreDamageToPoisoned > 0
    || snapshot.moreDamageToBurningTargets > 0
    || snapshot.pointBlankDamageFalloff != null
    || snapshot.pointBlankCloseHitKnockback != null
    || snapshot.noPierceNearbyHitDamageIncreased != null
    || snapshot.physicalHitDamageIncreased > 0
    || snapshot.suppressNonPhysicalHitDamage
    || snapshot.critRollsTwice
    || snapshot.triggeredHitsCanApplyDots
    || snapshot.convertAllHitDamageToChaos
    || snapshot.poisonExtraStackChance > 0
    || snapshot.doubleTriggers
    || snapshot.triggerProcChanceIncreased > 0
    || snapshot.retryFailedTriggerProcsOnce;
}

function hasRewardRuleSignal(snapshot: RewardRulesSnapshot): boolean {
  return snapshot.ringRewardOptionCountAdd > 0
    || snapshot.equippedFamilyWeightMultiplier > 1
    || snapshot.ringRewardRerollCount > 0;
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
    } else if (def!.mainEffect.kind === "DYNAMIC_STAT_MODIFIERS") {
      expect(collectWorldStatMods(world)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: STAT_KEYS.GLOBAL_HIT_DAMAGE_INCREASED,
            op: "increased",
          }),
        ]),
      );
    } else if (def!.mainEffect.kind === "FLOOR_LIFECYCLE") {
      const hpBefore = world.playerHp;
      applyFloorLifecycleEffects(world, "FLOOR_COMPLETE");
      expect(world.playerHp).toBeGreaterThan(hpBefore);
    } else if (def!.mainEffect.kind === "REWARD_RULES") {
      expect(hasRewardRuleSignal(collectWorldRewardRules(world))).toBe(true);
    }
  });
});
