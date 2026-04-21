import { PRJ_KIND } from "../../factories/projectileFactory";
import { STAT_KEYS } from "../../combat_mods/stats/statKeys";
import type {
  CombatRuleDef,
  EffectDef,
  ModOp,
  TriggeredEffectActionDef,
} from "../effects/effectTypes";
import {
  HAND_EFFECT_TYPES,
  RING_FAMILY_IDS,
  type RingDef,
  type RingFamilyTalentTreeDef,
  type RingTalentNodeDef,
} from "./ringTypes";

const VALID_MOD_OPS = new Set<ModOp>(["add", "increased", "decreased", "more", "less"]);
const VALID_TRIGGER_KEYS = new Set([
  "ON_HIT",
  "ON_KILL",
  "ON_CRIT",
  "ON_TICK",
  "ON_DODGE",
  "ON_MOVE",
  "OTHER",
]);

export type RingContentValidationIssue = {
  path: string;
  message: string;
};

export type RingContentIndex = {
  ringDefs: RingDef[];
  ringDefsById: Map<string, RingDef>;
  familyTrees: RingFamilyTalentTreeDef[];
  familyTreesById: Map<string, RingFamilyTalentTreeDef>;
  talentNodesById: Map<string, RingTalentNodeDef>;
};

function makeEmptyTree(familyId: RingFamilyTalentTreeDef["familyId"]): RingFamilyTalentTreeDef {
  return { familyId, nodes: [] };
}

export const RING_DEFS_V1: RingDef[] = [
  {
    id: "RING_STARTER_STREET_REFLEX",
    name: "Street Reflex",
    description: "On hit, 20% chance to throw an additional knife at a nearby enemy.",
    tier: 1,
    familyId: "starter",
    tags: ["starter", "trigger", "projectile"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.2,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.KNIFE,
        targeting: "NEAREST_ENEMY",
        origin: "PLAYER_AIM",
        rangePx: 260,
        speed: 260,
        ttl: 2,
        radius: 5,
        damageScalar: 1,
        damageType: "MATCH_HIT",
      },
    },
  },
  {
    id: "RING_STARTER_LUCKY_CHAMBER",
    name: "Lucky Chamber",
    description: "Every 5th shot is guaranteed to crit.",
    tier: 1,
    familyId: "starter",
    tags: ["starter", "crit", "weapon"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "EVERY_NTH_SHOT_CRITS", everyShots: 5 }],
    },
  },
  {
    id: "RING_STARTER_CONTAMINATED_ROUNDS",
    name: "Contaminated Rounds",
    description: "Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits.",
    tier: 1,
    familyId: "starter",
    tags: ["starter", "projectile", "poison"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [
        { kind: "PIERCE_POISONED_TARGETS" },
        { kind: "PIERCE_HITS_MORE_DAMAGE_TO_POISONED", more: 0.2 },
      ],
    },
  },
  {
    id: "RING_STARTER_POINT_BLANK_CARNAGE",
    name: "Point Blank Carnage",
    description: "Deal up to +50% damage based on proximity. Very close hits knock enemies back.",
    tier: 1,
    familyId: "starter",
    tags: ["starter", "damage", "close-range"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [
        { kind: "POINT_BLANK_DAMAGE_FALLOFF", maxRangePx: 220, maxMore: 0.5 },
        { kind: "POINT_BLANK_CLOSE_HIT_KNOCKBACK", rangePx: 84, basePushPx: 10, bonusPushPx: 34 },
      ],
    },
  },
  {
    id: "RING_STARTER_THERMAL_STARTER",
    name: "Thermal Starter",
    description: "Deal +15% damage to burning enemies.",
    tier: 1,
    familyId: "starter",
    tags: ["starter", "ignite", "damage"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "MORE_DAMAGE_TO_BURNING_TARGETS", more: 0.15 }],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_PERCENT_20",
    name: "20% More Damage",
    description: "20% more damage.",
    tier: 1,
    familyId: "generic",
    tags: ["generic", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_MORE_60_ATTACK_SPEED_LESS_30",
    name: "60% More Damage / 30% Less Attack Speed",
    description: "60% more damage. 30% less attack speed.",
    tier: 1,
    familyId: "generic",
    tags: ["generic", "damage", "attack-speed"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 0.6 },
        { key: STAT_KEYS.GLOBAL_ATTACK_SPEED_LESS, op: "less", value: 0.3 },
      ],
    },
  },
  {
    id: "RING_GENERIC_ATTACK_SPEED_MORE_60_DAMAGE_LESS_30",
    name: "60% More Attack Speed / 30% Less Damage",
    description: "60% more attack speed. 30% less damage.",
    tier: 1,
    familyId: "generic",
    tags: ["generic", "damage", "attack-speed"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_ATTACK_SPEED_MORE, op: "more", value: 0.6 },
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_LESS, op: "less", value: 0.3 },
      ],
    },
  },
  {
    id: "RING_GENERIC_DAMAGE_MORE_100_MAX_LIFE_LESS_50",
    name: "100% More Damage / 50% Less Maximum Life",
    description: "100% more damage. 50% less maximum life.",
    tier: 1,
    familyId: "generic",
    tags: ["generic", "damage", "life"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_MORE, op: "more", value: 1.0 },
        { key: STAT_KEYS.LIFE_LESS, op: "less", value: 0.5 },
      ],
    },
  },
  {
    id: "RING_GENERIC_MOVE_SPEED_20",
    name: "20% More Movement Speed",
    description: "20% more movement speed.",
    tier: 1,
    familyId: "generic",
    tags: ["generic", "movement"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.MOVE_SPEED_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_PHYSICAL_DAMAGE_PERCENT_20",
    name: "20% More Physical Damage",
    description: "20% more physical damage.",
    tier: 1,
    familyId: "physical",
    tags: ["physical", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PHYSICAL_HIT_DAMAGE_MORE, op: "more", value: 0.2 }],
    },
  },
  {
    id: "RING_PROJECTILE_ADDITIONAL_PROJECTILES_1",
    name: "+1 Projectile",
    description: "You gain +1 projectile.",
    tier: 1,
    familyId: "projectile",
    tags: ["projectile"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PROJECTILES_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_PROJECTILE_GAIN_PIERCE_1",
    name: "+1 Pierce",
    description: "Your projectiles gain +1 pierce.",
    tier: 1,
    familyId: "projectile",
    tags: ["projectile", "pierce"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.PIERCE_ADD, op: "add", value: 1 }],
    },
  },
  {
    id: "RING_DOT_DAMAGE_OVER_TIME_MORE_50",
    name: "50% More Damage Over Time",
    description: "Damage over time deals 50% more damage.",
    tier: 1,
    familyId: "dot",
    tags: ["dot"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.DOT_DAMAGE_MORE, op: "more", value: 0.5 }],
    },
  },
  {
    id: "RING_DOT_SPECIALIST",
    name: "DOT Specialist",
    description: "50% less hit damage. Damage over time deals 200% more damage.",
    tier: 1,
    familyId: "dot",
    tags: ["dot", "damage"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [
        { key: STAT_KEYS.GLOBAL_HIT_DAMAGE_LESS, op: "less", value: 0.5 },
        { key: STAT_KEYS.DOT_DAMAGE_MORE, op: "more", value: 2.0 },
      ],
    },
  },
  {
    id: "RING_DOT_TRIGGERED_HITS_CAN_APPLY_DOTS",
    name: "Triggered Hits Can Apply DOTs",
    description: "Damaging hits from triggered effects can apply DOTs.",
    tier: 1,
    familyId: "dot",
    tags: ["dot", "trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TRIGGERED_HITS_CAN_APPLY_DOTS" }],
    },
  },
  {
    id: "RING_CHAOS_ALL_HIT_DAMAGE_CONVERTED_TO_CHAOS",
    name: "All Hit Damage Converted to Chaos",
    description: "All hit damage is converted to chaos damage, including triggered effects.",
    tier: 1,
    familyId: "chaos",
    tags: ["chaos", "conversion"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS" }],
    },
  },
  {
    id: "RING_POISON_CHANCE_PERCENT_25",
    name: "+25% Poison Chance",
    description: "Gain +25% poison chance.",
    tier: 1,
    familyId: "poison",
    tags: ["poison"],
    mainEffect: {
      kind: "STAT_MODIFIERS",
      mods: [{ key: STAT_KEYS.CHANCE_TO_POISON_ADD, op: "add", value: 0.25 }],
    },
  },
  {
    id: "RING_POISON_TRIGGER_EXTRA_STACK_CHANCE_25",
    name: "Poisons Can Add an Extra Stack",
    description: "Poisons have 25% chance to apply an additional stack.",
    tier: 1,
    familyId: "poison",
    tags: ["poison"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "POISON_EXTRA_STACK_CHANCE", chance: 0.25 }],
    },
  },
  {
    id: "RING_IGNITE_SPREAD_ON_DEATH",
    name: "Ignite Spreads on Death",
    description: "Ignite spreads to nearby enemies on death.",
    tier: 1,
    familyId: "ignite",
    tags: ["ignite", "trigger"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      action: { kind: "SPREAD_IGNITE_ON_DEATH", radius: 96 },
    },
  },
  {
    id: "RING_IGNITE_CRITS_APPLY_IGNITE",
    name: "Crits Apply Ignite",
    description: "Crits ignite the target for 100% of the hit damage.",
    tier: 1,
    familyId: "ignite",
    tags: ["ignite", "crit"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_CRIT",
      action: { kind: "APPLY_IGNITE_FROM_HIT", damageScalar: 1.0 },
    },
  },
  {
    id: "RING_CRIT_ROLLS_TWICE",
    name: "Crit Rolls Twice",
    description: "Crit rolls twice.",
    tier: 1,
    familyId: "crit",
    tags: ["crit"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "CRIT_ROLLS_TWICE" }],
    },
  },
  {
    id: "RING_TRIGGER_BAZOOKA_ON_HIT",
    name: "Bazooka on Hit",
    description: "On hit: 10% chance to fire a bazooka dealing 300% of hit damage as physical damage.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger", "projectile", "physical"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.1,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.MISSILE,
        targeting: "EVENT_ENEMY",
        origin: "PLAYER_AIM",
        speed: 150,
        ttl: 2,
        radius: 5,
        damageScalar: 3.0,
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_SPARK_ON_HIT",
    name: "Spark on Hit",
    description: "On hit: 20% chance to zap the nearest enemy dealing 100% of hit damage as fire damage.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger", "projectile", "fire"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_HIT",
      procChance: 0.2,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.SPARK,
        targeting: "NEAREST_ENEMY",
        origin: "EVENT_POSITION",
        rangePx: 220,
        speed: 300,
        ttl: 3,
        radius: 6,
        damageScalar: 1.0,
        damageType: "FIRE",
        noCollide: true,
      },
    },
  },
  {
    id: "RING_TRIGGER_EXPLODE_ON_KILL",
    name: "Explode on Kill",
    description: "On kill: 20% chance for enemies to explode, dealing 50% of their maximum life as physical damage.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger", "physical", "aoe"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      procChance: 0.2,
      action: {
        kind: "EXPLODE_ON_DEATH",
        radius: 128,
        damageScalar: 0.5,
        damageBasis: "TARGET_MAX_LIFE",
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_DAGGER_ON_KILL",
    name: "Dagger on Kill",
    description: "On kill: 50% chance to fire a homing dagger at the nearest enemy dealing 100% of hit damage as physical damage.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger", "projectile", "physical"],
    mainEffect: {
      kind: "TRIGGERED",
      triggerKey: "ON_KILL",
      procChance: 0.5,
      action: {
        kind: "SPAWN_PROJECTILE",
        projectileKind: PRJ_KIND.DAGGER,
        targeting: "NEAREST_ENEMY",
        origin: "EVENT_POSITION",
        rangePx: 260,
        speed: 190,
        ttl: 6,
        radius: 8,
        damageScalar: 1.0,
        damageType: "PHYSICAL",
      },
    },
  },
  {
    id: "RING_TRIGGER_DOUBLE_TRIGGERS",
    name: "Double Triggers",
    description: "All triggers happen twice.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "DOUBLE_TRIGGERS" }],
    },
  },
  {
    id: "RING_TRIGGER_PROC_CHANCE_PERCENT_50",
    name: "+50% Trigger Proc Chance",
    description: "+50% increased trigger chance.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "TRIGGER_PROC_CHANCE_INCREASED", increased: 0.5 }],
    },
  },
  {
    id: "RING_TRIGGER_RETRY_FAILED_PROCS_ONCE",
    name: "Retry Failed Procs Once",
    description: "Failed procs retry once.",
    tier: 1,
    familyId: "trigger",
    tags: ["trigger"],
    mainEffect: {
      kind: "COMBAT_RULES",
      rules: [{ kind: "RETRY_FAILED_TRIGGER_PROCS_ONCE" }],
    },
  },
];

export const RING_FAMILY_TALENT_TREES_V1: RingFamilyTalentTreeDef[] = RING_FAMILY_IDS.map(makeEmptyTree);

function validateTriggeredAction(
  action: TriggeredEffectActionDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  if (!action || typeof action !== "object") {
    issues.push({ path, message: "Triggered effect requires action" });
    return;
  }

  switch (action.kind) {
    case "GAIN_ARMOR":
      if (!Number.isFinite(action.amount)) {
        issues.push({ path: `${path}.amount`, message: "GAIN_ARMOR amount must be finite" });
      }
      return;
    case "SPAWN_PROJECTILE":
      if (!Number.isFinite(action.speed) || action.speed < 0) {
        issues.push({ path: `${path}.speed`, message: "Projectile speed must be a non-negative finite number" });
      }
      if (!Number.isFinite(action.ttl) || action.ttl <= 0) {
        issues.push({ path: `${path}.ttl`, message: "Projectile ttl must be a positive finite number" });
      }
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Projectile radius must be a positive finite number" });
      }
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Projectile damageScalar must be a non-negative finite number" });
      }
      if (action.rangePx !== undefined && (!Number.isFinite(action.rangePx) || action.rangePx < 0)) {
        issues.push({ path: `${path}.rangePx`, message: "Projectile rangePx must be a non-negative finite number" });
      }
      if (action.explodeRadius !== undefined && (!Number.isFinite(action.explodeRadius) || action.explodeRadius < 0)) {
        issues.push({ path: `${path}.explodeRadius`, message: "Projectile explodeRadius must be a non-negative finite number" });
      }
      return;
    case "EXPLODE_ON_DEATH":
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Explosion radius must be a positive finite number" });
      }
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Explosion damageScalar must be a non-negative finite number" });
      }
      return;
    case "SPREAD_IGNITE_ON_DEATH":
      if (!Number.isFinite(action.radius) || action.radius <= 0) {
        issues.push({ path: `${path}.radius`, message: "Ignite spread radius must be a positive finite number" });
      }
      return;
    case "APPLY_IGNITE_FROM_HIT":
      if (!Number.isFinite(action.damageScalar) || action.damageScalar < 0) {
        issues.push({ path: `${path}.damageScalar`, message: "Ignite damageScalar must be a non-negative finite number" });
      }
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported triggered action: ${String((action as { kind?: unknown }).kind)}` });
  }
}

function validateCombatRule(
  rule: CombatRuleDef,
  path: string,
  issues: RingContentValidationIssue[],
): void {
  switch (rule.kind) {
    case "EVERY_NTH_SHOT_CRITS":
      if (!Number.isFinite(rule.everyShots) || rule.everyShots <= 0) {
        issues.push({ path: `${path}.everyShots`, message: "everyShots must be a positive finite number" });
      }
      return;
    case "PIERCE_HITS_MORE_DAMAGE_TO_POISONED":
    case "MORE_DAMAGE_TO_BURNING_TARGETS":
      if (!Number.isFinite(rule.more) || rule.more < 0) {
        issues.push({ path: `${path}.more`, message: "more must be a non-negative finite number" });
      }
      return;
    case "POINT_BLANK_DAMAGE_FALLOFF":
      if (!Number.isFinite(rule.maxRangePx) || rule.maxRangePx <= 0) {
        issues.push({ path: `${path}.maxRangePx`, message: "maxRangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.maxMore) || rule.maxMore < 0) {
        issues.push({ path: `${path}.maxMore`, message: "maxMore must be a non-negative finite number" });
      }
      return;
    case "POINT_BLANK_CLOSE_HIT_KNOCKBACK":
      if (!Number.isFinite(rule.rangePx) || rule.rangePx <= 0) {
        issues.push({ path: `${path}.rangePx`, message: "rangePx must be a positive finite number" });
      }
      if (!Number.isFinite(rule.basePushPx) || rule.basePushPx < 0) {
        issues.push({ path: `${path}.basePushPx`, message: "basePushPx must be a non-negative finite number" });
      }
      if (!Number.isFinite(rule.bonusPushPx) || rule.bonusPushPx < 0) {
        issues.push({ path: `${path}.bonusPushPx`, message: "bonusPushPx must be a non-negative finite number" });
      }
      return;
    case "POISON_EXTRA_STACK_CHANCE":
      if (!Number.isFinite(rule.chance) || rule.chance < 0 || rule.chance > 1) {
        issues.push({ path: `${path}.chance`, message: "chance must be a finite value between 0 and 1" });
      }
      return;
    case "TRIGGER_PROC_CHANCE_INCREASED":
      if (!Number.isFinite(rule.increased) || rule.increased < 0) {
        issues.push({ path: `${path}.increased`, message: "increased must be a non-negative finite number" });
      }
      return;
    case "PIERCE_POISONED_TARGETS":
    case "CRIT_ROLLS_TWICE":
    case "TRIGGERED_HITS_CAN_APPLY_DOTS":
    case "CONVERT_ALL_HIT_DAMAGE_TO_CHAOS":
    case "DOUBLE_TRIGGERS":
    case "RETRY_FAILED_TRIGGER_PROCS_ONCE":
      return;
    default:
      issues.push({ path: `${path}.kind`, message: `Unsupported combat rule: ${String((rule as { kind?: unknown }).kind)}` });
  }
}

function validateEffectDef(effect: EffectDef, path: string, issues: RingContentValidationIssue[]): void {
  if (!effect || typeof effect !== "object") {
    issues.push({ path, message: "Effect must be an object" });
    return;
  }
  if (effect.kind === "STAT_MODIFIERS") {
    if (!Array.isArray(effect.mods)) {
      issues.push({ path, message: "STAT_MODIFIERS requires mods[]" });
      return;
    }
    for (let i = 0; i < effect.mods.length; i++) {
      const mod = effect.mods[i];
      const modPath = `${path}.mods[${i}]`;
      if (!mod || typeof mod !== "object") {
        issues.push({ path: modPath, message: "Modifier must be an object" });
        continue;
      }
      if (typeof mod.key !== "string" || mod.key.length <= 0) {
        issues.push({ path: `${modPath}.key`, message: "Modifier key must be a non-empty string" });
      }
      if (!VALID_MOD_OPS.has(mod.op)) {
        issues.push({ path: `${modPath}.op`, message: `Unsupported modifier op: ${String(mod.op)}` });
      }
      if (!Number.isFinite(mod.value)) {
        issues.push({ path: `${modPath}.value`, message: "Modifier value must be finite" });
      }
    }
    return;
  }

  if (effect.kind === "TRIGGERED") {
    if (!VALID_TRIGGER_KEYS.has(effect.triggerKey)) {
      issues.push({ path: `${path}.triggerKey`, message: `Unknown trigger key: ${String(effect.triggerKey)}` });
    }
    if (effect.procChance !== undefined && (!Number.isFinite(effect.procChance) || effect.procChance < 0 || effect.procChance > 1)) {
      issues.push({ path: `${path}.procChance`, message: "procChance must be a finite value between 0 and 1" });
    }
    validateTriggeredAction(effect.action, `${path}.action`, issues);
    return;
  }

  if (effect.kind === "COMBAT_RULES") {
    if (!Array.isArray(effect.rules) || effect.rules.length <= 0) {
      issues.push({ path: `${path}.rules`, message: "COMBAT_RULES requires a non-empty rules[]" });
      return;
    }
    for (let i = 0; i < effect.rules.length; i++) {
      validateCombatRule(effect.rules[i], `${path}.rules[${i}]`, issues);
    }
    return;
  }

  if (effect.kind === "HAND_STRUCTURE") {
    if (!HAND_EFFECT_TYPES.includes(effect.effectType)) {
      issues.push({ path: `${path}.effectType`, message: `Unknown hand effect type: ${String(effect.effectType)}` });
    }
    return;
  }

  issues.push({ path: `${path}.kind`, message: `Unsupported effect kind: ${String((effect as { kind?: unknown }).kind)}` });
}

function validateFamilyTreeCycles(tree: RingFamilyTalentTreeDef, issues: RingContentValidationIssue[]): void {
  const nodesById = new Map<string, RingTalentNodeDef>();
  for (const node of tree.nodes) {
    nodesById.set(node.id, node);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string, chain: string[]): void => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      issues.push({
        path: `familyTrees.${tree.familyId}.nodes.${nodeId}`,
        message: `Cycle detected in prerequisites: ${[...chain, nodeId].join(" -> ")}`,
      });
      return;
    }

    const node = nodesById.get(nodeId);
    if (!node) return;

    visiting.add(nodeId);
    for (const requiredId of node.requiresNodeIds) {
      if (!nodesById.has(requiredId)) continue;
      visit(requiredId, [...chain, nodeId]);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of tree.nodes) {
    visit(node.id, []);
  }
}

export function validateRingContent(
  ringDefs: readonly RingDef[],
  familyTrees: readonly RingFamilyTalentTreeDef[],
): RingContentValidationIssue[] {
  const issues: RingContentValidationIssue[] = [];
  const ringIds = new Set<string>();
  const familyIds = new Set<string>();
  const nodeIds = new Set<string>();

  for (let i = 0; i < familyTrees.length; i++) {
    const tree = familyTrees[i];
    const treePath = `familyTrees[${i}]`;
    if (!RING_FAMILY_IDS.includes(tree.familyId)) {
      issues.push({ path: `${treePath}.familyId`, message: `Unknown ring family: ${String(tree.familyId)}` });
    }
    if (familyIds.has(tree.familyId)) {
      issues.push({ path: `${treePath}.familyId`, message: `Duplicate family tree: ${tree.familyId}` });
    }
    familyIds.add(tree.familyId);

    if (tree.nodes.length > 0) {
      issues.push({ path: `${treePath}.nodes`, message: "V1 ring families must not author talent nodes in this pass" });
    }

    const localNodeIds = new Set<string>();
    for (let j = 0; j < tree.nodes.length; j++) {
      const node = tree.nodes[j];
      const nodePath = `${treePath}.nodes[${j}]`;
      if (localNodeIds.has(node.id)) {
        issues.push({ path: `${nodePath}.id`, message: `Duplicate node id in family ${tree.familyId}: ${node.id}` });
      }
      if (nodeIds.has(node.id)) {
        issues.push({ path: `${nodePath}.id`, message: `Duplicate node id across families: ${node.id}` });
      }
      localNodeIds.add(node.id);
      nodeIds.add(node.id);

      if (!Number.isFinite(node.cost) || node.cost <= 0) {
        issues.push({ path: `${nodePath}.cost`, message: "Talent node cost must be a positive finite number" });
      }
      for (const requiredId of node.requiresNodeIds) {
        if (!tree.nodes.some((candidate) => candidate.id === requiredId)) {
          issues.push({
            path: `${nodePath}.requiresNodeIds`,
            message: `Missing prerequisite node "${requiredId}" in family ${tree.familyId}`,
          });
        }
      }
      validateEffectDef(node.effect, `${nodePath}.effect`, issues);
    }

    validateFamilyTreeCycles(tree, issues);
  }

  for (const familyId of RING_FAMILY_IDS) {
    if (!familyIds.has(familyId)) {
      issues.push({ path: "familyTrees", message: `Missing family talent tree for ${familyId}` });
    }
  }

  for (let i = 0; i < ringDefs.length; i++) {
    const def = ringDefs[i];
    const defPath = `ringDefs[${i}]`;
    if (ringIds.has(def.id)) {
      issues.push({ path: `${defPath}.id`, message: `Duplicate ring id: ${def.id}` });
    }
    ringIds.add(def.id);
    if (!RING_FAMILY_IDS.includes(def.familyId)) {
      issues.push({ path: `${defPath}.familyId`, message: `Unknown ring family: ${String(def.familyId)}` });
    }
    if (!familyIds.has(def.familyId)) {
      issues.push({ path: `${defPath}.familyId`, message: `Missing family talent tree for ${def.familyId}` });
    }
    if (typeof def.name !== "string" || def.name.trim().length <= 0) {
      issues.push({ path: `${defPath}.name`, message: "Ring name must be a non-empty string" });
    }
    if (typeof def.description !== "string" || def.description.trim().length <= 0) {
      issues.push({ path: `${defPath}.description`, message: "Ring description must be a non-empty string" });
    }
    if (def.tier !== 1) {
      issues.push({ path: `${defPath}.tier`, message: "V1 ring content must lock every ring to tier 1" });
    }
    validateEffectDef(def.mainEffect, `${defPath}.mainEffect`, issues);
  }

  return issues;
}

export function createRingContentIndex(
  ringDefs: readonly RingDef[],
  familyTrees: readonly RingFamilyTalentTreeDef[],
): RingContentIndex {
  const issues = validateRingContent(ringDefs, familyTrees);
  if (issues.length > 0) {
    throw new Error(
      [
        "Invalid ring content:",
        ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
      ].join("\n"),
    );
  }

  const ringDefsById = new Map<string, RingDef>();
  for (const def of ringDefs) {
    ringDefsById.set(def.id, def);
  }

  const familyTreesById = new Map<string, RingFamilyTalentTreeDef>();
  const talentNodesById = new Map<string, RingTalentNodeDef>();
  for (const tree of familyTrees) {
    familyTreesById.set(tree.familyId, tree);
    for (const node of tree.nodes) {
      talentNodesById.set(node.id, node);
    }
  }

  return {
    ringDefs: [...ringDefs],
    ringDefsById,
    familyTrees: [...familyTrees],
    familyTreesById,
    talentNodesById,
  };
}

const RING_CONTENT_V1 = createRingContentIndex(RING_DEFS_V1, RING_FAMILY_TALENT_TREES_V1);

export function assertProgressionContentValid(): void {
  void RING_CONTENT_V1;
}

export function getAllRingDefs(): RingDef[] {
  return [...RING_CONTENT_V1.ringDefs];
}

export function getAllRingFamilyTalentTrees(): RingFamilyTalentTreeDef[] {
  return [...RING_CONTENT_V1.familyTrees];
}

export function getRingDefById(id: string): RingDef | undefined {
  return RING_CONTENT_V1.ringDefsById.get(id);
}

export function getRingFamilyTalentTreeById(familyId: string): RingFamilyTalentTreeDef | undefined {
  return RING_CONTENT_V1.familyTreesById.get(familyId);
}

export function getRingTalentNodeById(nodeId: string): RingTalentNodeDef | undefined {
  return RING_CONTENT_V1.talentNodesById.get(nodeId);
}
