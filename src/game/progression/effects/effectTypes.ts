// @system   ring-progression/system
// @owns     define runtime effect, stat modifier, trigger action, and combat rule vocabularies
// @doc      docs/canonical/ring_progression_system.md
// @agents   no ring content, state mutation, or trigger execution; see ringContent.ts, ringState.ts, and triggeredEffects.ts

import type { TriggerKey } from "../../events";
import type { StatKey } from "../../combat_mods/stats/statKeys";
import type { ProjectileKind } from "../../factories/projectileFactory";

export type ModOp = "add" | "increased" | "decreased" | "more" | "less";

/**
 * A single numeric stat modifier.
 *
 * Conventions:
 * - "add" is raw addition to a base stat.
 * - "increased"/"decreased" are additive scaling, expressed as fractions.
 * - "more"/"less" are multiplicative scaling, expressed as fractions.
 */
export interface StatMod {
  key: StatKey;
  op: ModOp;
  value: number;
}

export type EffectSourceKind =
  | "RING_MAIN"
  | "RING_TALENT"
  | "HAND_FINGER";

export type EffectSourceRef = {
  kind: EffectSourceKind;
  id: string;
  ringInstanceId?: string;
  ringDefId?: string;
  slotId?: string;
  nodeId?: string;
};

export type StatModifierEffectDef = {
  kind: "STAT_MODIFIERS";
  mods: StatMod[];
};

export type DynamicStatModifierDef =
  | {
      kind: "GLOBAL_HIT_DAMAGE_INCREASED_FROM_MAX_LIFE";
      increasedPerMaxLife: number;
    }
  | {
      kind: "GLOBAL_HIT_DAMAGE_INCREASED_PER_MISSING_LIFE";
      missingLifeStep: number;
      increasedPerStep: number;
    };

export type DynamicStatModifierEffectDef = {
  kind: "DYNAMIC_STAT_MODIFIERS";
  mods: DynamicStatModifierDef[];
};

export type FloorLifecycleTrigger = "FLOOR_COMPLETE";

export type HealPlayerFloorLifecycleActionDef = {
  kind: "HEAL_PLAYER";
  amount: number;
};

export type FloorLifecycleActionDef = HealPlayerFloorLifecycleActionDef;

export type FloorLifecycleEffectDef = {
  kind: "FLOOR_LIFECYCLE";
  trigger: FloorLifecycleTrigger;
  action: FloorLifecycleActionDef;
};

export type RewardRuleDef =
  | {
      kind: "RING_REWARD_OPTION_COUNT_ADD";
      add: number;
    }
  | {
      kind: "RING_REWARD_EQUIPPED_FAMILY_WEIGHT_MULTIPLIER";
      multiplier: number;
    }
  | {
      kind: "RING_REWARD_REROLL_ADD";
      count: number;
    };

export type RewardRulesEffectDef = {
  kind: "REWARD_RULES";
  rules: RewardRuleDef[];
};

export type WeaponFireRuleDef = {
  kind: "BACKFIRE_PROJECTILE";
};

export type WeaponFireRulesEffectDef = {
  kind: "WEAPON_FIRE_RULES";
  rules: WeaponFireRuleDef[];
};

export type TriggeredEffectDef = {
  kind: "TRIGGERED";
  triggerKey: TriggerKey;
  procChance?: number;
  action: TriggeredEffectActionDef;
};

export type GainArmorTriggeredActionDef = {
  kind: "GAIN_ARMOR";
  amount: number;
};

export type TriggerDamageType =
  | "MATCH_HIT"
  | "PHYSICAL"
  | "FIRE"
  | "CHAOS";

export type TriggerProjectileTargeting =
  | "EVENT_ENEMY"
  | "NEAREST_ENEMY";

export type TriggerProjectileOrigin =
  | "PLAYER_AIM"
  | "EVENT_POSITION";

export type SpawnProjectileTriggeredActionDef = {
  kind: "SPAWN_PROJECTILE";
  projectileKind: ProjectileKind;
  targeting: TriggerProjectileTargeting;
  origin: TriggerProjectileOrigin;
  rangePx?: number;
  speed: number;
  ttl: number;
  radius: number;
  damageScalar: number;
  damageType: TriggerDamageType;
  explodeRadius?: number;
  noCollide?: boolean;
};

export type DeathExplosionTriggeredActionDef = {
  kind: "EXPLODE_ON_DEATH";
  radius: number;
  damageScalar: number;
  damageBasis: "TARGET_MAX_LIFE" | "EVENT_HIT_DAMAGE";
  damageType: TriggerDamageType;
};

export type SpreadIgniteTriggeredActionDef = {
  kind: "SPREAD_IGNITE_ON_DEATH";
  radius: number;
};

export type ApplyIgniteFromHitTriggeredActionDef = {
  kind: "APPLY_IGNITE_FROM_HIT";
  damageScalar: number;
};

export type ChainHitTriggeredActionDef = {
  kind: "CHAIN_HIT";
  maxTargets: number;
  jumpRangePx: number;
  damageScalar: number;
  damageType: TriggerDamageType;
};

export type StunExplosionTriggeredActionDef = {
  kind: "STUN_EXPLOSION";
  radius: number;
  stunDurationSec: number;
};

export type TriggeredEffectActionDef =
  | GainArmorTriggeredActionDef
  | SpawnProjectileTriggeredActionDef
  | DeathExplosionTriggeredActionDef
  | SpreadIgniteTriggeredActionDef
  | ApplyIgniteFromHitTriggeredActionDef
  | ChainHitTriggeredActionDef
  | StunExplosionTriggeredActionDef;

export type EveryNthShotCritsCombatRule = {
  kind: "EVERY_NTH_SHOT_CRITS";
  everyShots: number;
};

export type PiercePoisonedTargetsCombatRule = {
  kind: "PIERCE_POISONED_TARGETS";
};

export type PierceHitsMoreDamageToPoisonedCombatRule = {
  kind: "PIERCE_HITS_MORE_DAMAGE_TO_POISONED";
  more: number;
};

export type MoreDamageToBurningTargetsCombatRule = {
  kind: "MORE_DAMAGE_TO_BURNING_TARGETS";
  more: number;
};

export type PointBlankDamageFalloffCombatRule = {
  kind: "POINT_BLANK_DAMAGE_FALLOFF";
  maxRangePx: number;
  maxMore: number;
};

export type PointBlankCloseHitKnockbackCombatRule = {
  kind: "POINT_BLANK_CLOSE_HIT_KNOCKBACK";
  rangePx: number;
  basePushPx: number;
  bonusPushPx: number;
};

export type NoPierceNearbyHitDamageIncreasedCombatRule = {
  kind: "NO_PIERCE_NEARBY_HIT_DAMAGE_INCREASED";
  rangePx: number;
  increased: number;
};

export type PhysicalHitDamageIncreasedNonPhysicalSuppressedCombatRule = {
  kind: "PHYSICAL_HIT_DAMAGE_INCREASED_NON_PHYSICAL_SUPPRESSED";
  increased: number;
};

export type PhysicalHitDamageIncreasedPerEquippedFamilyRingCombatRule = {
  kind: "PHYSICAL_HIT_DAMAGE_INCREASED_PER_EQUIPPED_FAMILY_RING";
  familyId: string;
  increasedPerRing: number;
};

export type ProjectileHitDamageIncreasedPerPiercedEnemyCombatRule = {
  kind: "PROJECTILE_HIT_DAMAGE_INCREASED_PER_PIERCED_ENEMY";
  increasedPerEnemy: number;
};

export type CritRollsTwiceCombatRule = {
  kind: "CRIT_ROLLS_TWICE";
};

export type TriggeredHitsCanApplyDotsCombatRule = {
  kind: "TRIGGERED_HITS_CAN_APPLY_DOTS";
};

export type ConvertAllHitDamageToChaosCombatRule = {
  kind: "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS";
};

export type PoisonExtraStackChanceCombatRule = {
  kind: "POISON_EXTRA_STACK_CHANCE";
  chance: number;
};

export type DoubleTriggersCombatRule = {
  kind: "DOUBLE_TRIGGERS";
};

export type TriggerProcChanceIncreasedCombatRule = {
  kind: "TRIGGER_PROC_CHANCE_INCREASED";
  increased: number;
};

export type RetryFailedTriggerProcsOnceCombatRule = {
  kind: "RETRY_FAILED_TRIGGER_PROCS_ONCE";
};

export type PoisonedEnemiesExplodeOnDeathCombatRule = {
  kind: "POISONED_ENEMIES_EXPLODE_ON_DEATH";
  radius: number;
  damageScalar: number;
  damageType: TriggerDamageType;
};

export type BurningEnemiesMoveSpeedReducedCombatRule = {
  kind: "BURNING_ENEMIES_MOVE_SPEED_REDUCED";
  reduced: number;
};

export type PoisonedEnemiesDamageReducedCombatRule = {
  kind: "POISONED_ENEMIES_DAMAGE_REDUCED";
  reduced: number;
};

export type PoisonTrailCombatRule = {
  kind: "POISON_TRAIL";
  radius: number;
  poisonDps: number;
  tickEvery: number;
  trailTtl: number;
  dropEvery: number;
};

export type LaserExecutorCombatRule = {
  kind: "LASER_EXECUTOR";
  thresholdFraction: number;
  rangePx: number;
  scanEvery: number;
};

export type PhysicalHitStunChanceCombatRule = {
  kind: "PHYSICAL_HIT_STUN_CHANCE";
  chance: number;
  stunDurationSec: number;
};

export type TimedNextShotEmpowerCombatRule = {
  kind: "TIMED_NEXT_SHOT_EMPOWER";
  chargeEvery: number;
  physicalDamageIncreased: number;
};

export type KillEmpowerNextShotCombatRule = {
  kind: "KILL_EMPOWER_NEXT_SHOT";
  damageIncreased: number;
};

export type CritMoveSpeedBuffCombatRule = {
  kind: "CRIT_MOVE_SPEED_BUFF";
  moveSpeedIncreased: number;
  durationSec: number;
};

export type LivingBombCombatRule = {
  kind: "LIVING_BOMB";
  markEvery: number;
  speedIncreased: number;
  explosionDamageScalar: number;
  explosionRadius: number;
};

export type CombatRuleDef =
  | EveryNthShotCritsCombatRule
  | PiercePoisonedTargetsCombatRule
  | PierceHitsMoreDamageToPoisonedCombatRule
  | MoreDamageToBurningTargetsCombatRule
  | PointBlankDamageFalloffCombatRule
  | PointBlankCloseHitKnockbackCombatRule
  | NoPierceNearbyHitDamageIncreasedCombatRule
  | PhysicalHitDamageIncreasedNonPhysicalSuppressedCombatRule
  | PhysicalHitDamageIncreasedPerEquippedFamilyRingCombatRule
  | ProjectileHitDamageIncreasedPerPiercedEnemyCombatRule
  | CritRollsTwiceCombatRule
  | TriggeredHitsCanApplyDotsCombatRule
  | ConvertAllHitDamageToChaosCombatRule
  | PoisonExtraStackChanceCombatRule
  | DoubleTriggersCombatRule
  | TriggerProcChanceIncreasedCombatRule
  | RetryFailedTriggerProcsOnceCombatRule
  | PoisonedEnemiesExplodeOnDeathCombatRule
  | BurningEnemiesMoveSpeedReducedCombatRule
  | PoisonedEnemiesDamageReducedCombatRule
  | PoisonTrailCombatRule
  | LaserExecutorCombatRule
  | PhysicalHitStunChanceCombatRule
  | TimedNextShotEmpowerCombatRule
  | KillEmpowerNextShotCombatRule
  | CritMoveSpeedBuffCombatRule
  | LivingBombCombatRule;

export type CombatRulesEffectDef = {
  kind: "COMBAT_RULES";
  rules: CombatRuleDef[];
};

export type StructuralHandEffectDef = {
  kind: "HAND_STRUCTURE";
  effectType: "ADD_FINGER" | "EMPOWER_FINGER";
  params?: Record<string, unknown>;
};

export type MirrorLeftRingEffectDef = {
  kind: "MIRROR_LEFT_RING";
};

export type AmplifyNeighborsEffectDef = {
  kind: "AMPLIFY_NEIGHBORS";
  increasedEffectBonus: number;
};

export type EffectDef =
  | StatModifierEffectDef
  | DynamicStatModifierEffectDef
  | FloorLifecycleEffectDef
  | RewardRulesEffectDef
  | WeaponFireRulesEffectDef
  | TriggeredEffectDef
  | CombatRulesEffectDef
  | StructuralHandEffectDef
  | MirrorLeftRingEffectDef
  | AmplifyNeighborsEffectDef;

export type RuntimeEffect = {
  source: EffectSourceRef;
  effect: EffectDef;
  /**
   * Applies to numerical values in STAT_MODIFIERS. A value of 0.2 means
   * "20% increased effect" and scales authored numbers by 1.2.
   */
  increasedEffectScalar?: number;
};
