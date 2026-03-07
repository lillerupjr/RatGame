import type { PlayableCharacterId } from "./playableCharacters";

export type RelicSource = "starter" | "drop" | "shop" | "debug";

export type RelicInstance = {
  id: string;
  source?: RelicSource;
  isLocked?: boolean;
};

export type RelicDef = {
  id: string;
  isEnabled: boolean;
  displayName: string;
  kind: "PASSIVE" | "ACTIVE";
  tags?: string[];
  shortDesc?: string;
  longDesc?: string[];
  desc?: string[];
  isStarter?: true;
  starterFor?: PlayableCharacterId;
};

export const MOMENTUM_RELIC_TAG = "MOMENTUM";

export const RELICS: RelicDef[] = [
  {
    id: "PASS_MOVE_SPEED_20",
    isEnabled: true,
    displayName: "20% more movement speed",
    kind: "PASSIVE",
    desc: ["20% more movement speed"],
  },
  {
    id: "PASS_DAMAGE_PERCENT_20",
    isEnabled: true,
    displayName: "20% more Damage",
    kind: "PASSIVE",
    desc: ["Deal 20% more damage"],
  },
  {
    id: "PASS_LIFE_TO_DAMAGE_2P",
    isEnabled: true,
    displayName: "Gain more Damage equal to 20% of Maximum Life",
    kind: "PASSIVE",
    desc: ["Gain more Damage equal to 20% of Maximum Life"],
  },
  {
    id: "MOM_DAMAGE_PER_MOMENTUM_5",
    isEnabled: true,
    displayName: "+3% more Damage per Momentum",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["+3% more Damage per Momentum"],
  },
  {
    id: "MOM_MOVE_SPEED_PER_MOMENTUM_3",
    isEnabled: true,
    displayName: "+2% increased Move Speed per Momentum",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["+2% increased Move Speed per Momentum"],
  },
  {
    id: "MOM_MAX_MOMENTUM_PLUS_10",
    isEnabled: true,
    displayName: "+10 Maximum Momentum",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["+10 Maximum Momentum"],
  },
  {
    id: "MOM_PROC_POWER_SCALING_2P",
    isEnabled: true,
    displayName: "Trigger effects deal 2% more damage per Momentum",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["Trigger effects deal 2% more damage per Momentum"],
  },
  {
    id: "MOM_FULL_BREAK_GRANTS_ARMOR_20",
    isEnabled: true,
    displayName: "When full Momentum breaks, gain 20 Armor",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["When full Momentum breaks, gain 20 Armor"],
  },
  {
    id: "MOM_FULL_CRIT_DOUBLE",
    isEnabled: true,
    displayName: "At full Momentum, Crit Chance is doubled",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["At full Momentum, Crit Chance is doubled"],
  },
  {
    id: "MOM_DECAY_DELAY_PLUS_1",
    isEnabled: true,
    displayName: "Momentum decays 1s later",
    kind: "PASSIVE",
    tags: [MOMENTUM_RELIC_TAG],
    desc: ["Momentum decays 1s later"],
  },
  {
    id: "SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40",
    isEnabled: true,
    displayName: "100% more damage\n30% less attack speed",
    kind: "PASSIVE",
    desc: ["100% more damage", "30% less attack speed"],
  },
  {
    id: "SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30",
    isEnabled: true,
    displayName: "50% more attack speed\n30% less damage",
    kind: "PASSIVE",
    desc: ["50% more attack speed", "30% less damage"],
  },
  {
    id: "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50",
    isEnabled: true,
    displayName: "200% more damage\n50% less maximum Life",
    kind: "PASSIVE",
    desc: ["200% more damage", "50% less maximum Life"],
  },
  {
    id: "SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20",
    isEnabled: true,
    displayName: "+100 Armor\n20% less movement speed",
    kind: "PASSIVE",
    desc: ["+100 Armor", "20% less movement speed"],
  },
  {
    id: "ACT_BAZOOKA_ON_HIT_20",
    isEnabled: true,
    displayName: "On hit: fire a bazooka dealing 20% of hit damage",
    kind: "ACTIVE",
    desc: ["On hit: fire a bazooka dealing 20% of hit damage"],
  },
  {
    id: "ACT_EXPLODE_ON_KILL",
    isEnabled: true,
    displayName: "On kill: enemies explode",
    kind: "ACTIVE",
    desc: ["On kill: enemies explode"],
  },
  {
    id: "ACT_ALL_HITS_EXPLODE_20",
    isEnabled: true,
    displayName: "All hits explode for 20% of hit damage",
    kind: "ACTIVE",
    desc: ["All hits explode for 20% of hit damage"],
  },
  {
    id: "ACT_TRIGGERS_DOUBLE",
    isEnabled: true,
    displayName: "All triggers happen twice",
    kind: "ACTIVE",
  },
  {
    id: "ACT_SPARK_ON_HIT_20",
    isEnabled: true,
    displayName: "On hit: 20% chance to spark nearest enemy",
    kind: "ACTIVE",
    desc: ["On hit: 20% chance to spark nearest enemy for 30% damage"],
  },
  {
    id: "ACT_RETRY_FAILED_PROCS_ONCE",
    isEnabled: true,
    displayName: "Failed procs retry once",
    kind: "ACTIVE",
    desc: ["Failed proc rolls retry once"],
  },
  {
    id: "ACT_PROC_CHANCE_PERCENT_50",
    isEnabled: true,
    displayName: "+50% increased Relic Proc Chance",
    kind: "ACTIVE",
    desc: ["+50% increased Relic Proc Chance"],
  },
  {
    id: "ACT_NOVA_ON_CRIT_FIRE",
    isEnabled: true,
    displayName: "On crit: spawn a fire damage zone",
    kind: "ACTIVE",
    desc: ["On crit: chance to spawn a fire damage zone"],
  },
  {
    id: "ACT_DAGGER_ON_KILL_50",
    isEnabled: true,
    displayName: "On kill: 50% chance to fire a homing dagger",
    kind: "ACTIVE",
    desc: ["On kill: chance to fire a homing dagger"],
  },
  {
    id: "ACT_IGNITE_SPREAD_ON_DEATH",
    isEnabled: true,
    displayName: "Ignite spreads to all nearby enemies on death",
    kind: "ACTIVE",
    desc: ["When an ignited enemy dies, ignite spreads to all nearby enemies"],
  },
  {
    id: "PASS_CRIT_ROLLS_TWICE",
    isEnabled: true,
    displayName: "Crit rolls twice",
    kind: "PASSIVE",
  },
  {
    id: "PASS_DAMAGE_TO_POISON_ALL",
    isEnabled: true,
    displayName: "All damage contributes to poison",
    kind: "PASSIVE",
  },
  {
    id: "PASS_LIFE_ON_HIT_2",
    isEnabled: true,
    displayName: "Heal 2 life on hit",
    kind: "PASSIVE",
  },
  {
    id: "PASS_DOT_MORE_50",
    isEnabled: true,
    displayName: "Damage over time deals 50% more damage",
    kind: "PASSIVE",
    desc: ["Damage over time deals 50% more damage"],
  },
  {
    id: "SPEC_DOT_SPECIALIST",
    isEnabled: true,
    displayName: "-50% hit damage\nDamage over time deals 200% more damage",
    kind: "PASSIVE",
    desc: ["-50% hit damage", "Damage over time deals 200% more damage"],
  },
  {
    id: "ARMOR_MAX_50",
    isEnabled: true,
    displayName: "+50 Maximum Armor",
    kind: "PASSIVE",
    desc: ["+50 Maximum Armor"],
  },
  {
    id: "ARMOR_RESTORE_ON_KILL_10",
    isEnabled: true,
    displayName: "Restore 10 armor on kill",
    kind: "ACTIVE",
  },
  {
    id: "ARMOR_RESTORE_ON_HIT_1",
    isEnabled: true,
    displayName: "Restore 1 armor on hit",
    kind: "ACTIVE",
  },
  {
    id: "ARMOR_RESTORE_ON_CRIT_5",
    isEnabled: true,
    displayName: "Restore 5 armor on crit",
    kind: "ACTIVE",
  },
  {
    id: "STARTER_STREET_REFLEX",
    isEnabled: true,
    displayName: "Street Reflex",
    kind: "ACTIVE",
    shortDesc: "On hit, 20% chance to throw an additional knife at a nearby enemy.",
    desc: ["On hit, 20% chance to throw an additional knife at a nearby enemy."],
    longDesc: ["On hit, 20% chance to throw an additional knife at a nearby enemy."],
    isStarter: true,
    starterFor: "JAMAL",
  },
  {
    id: "STARTER_LUCKY_CHAMBER",
    isEnabled: true,
    displayName: "Lucky Chamber",
    kind: "PASSIVE",
    shortDesc: "Every 5th shot is guaranteed to crit.",
    desc: ["Every 5th shot is guaranteed to crit."],
    longDesc: ["Every 5th shot is guaranteed to crit."],
    isStarter: true,
    starterFor: "JACK",
  },
  {
    id: "STARTER_CONTAMINATED_ROUNDS",
    isEnabled: true,
    displayName: "Contaminated Rounds",
    kind: "PASSIVE",
    shortDesc: "Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits.",
    desc: ["Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits."],
    longDesc: ["Projectiles pierce poisoned enemies. Poisoned enemies take +20% damage from piercing hits."],
    isStarter: true,
    starterFor: "HOBO",
  },
  {
    id: "STARTER_POINT_BLANK_CARNAGE",
    isEnabled: true,
    displayName: "Point Blank Carnage",
    kind: "PASSIVE",
    shortDesc: "Deal up to +50% damage based on proximity. Very close hits knock enemies back.",
    desc: ["Deal up to +50% damage based on proximity. Very close hits knock enemies back."],
    longDesc: ["Deal up to +50% damage based on proximity. Enemies hit within very close range are knocked back."],
    isStarter: true,
    starterFor: "TOMMY",
  },
  {
    id: "STARTER_THERMAL_STARTER",
    isEnabled: true,
    displayName: "Thermal Starter",
    kind: "PASSIVE",
    shortDesc: "Deal +15% damage to burning enemies.",
    desc: ["Deal +15% damage to burning enemies."],
    longDesc: ["Deal +15% damage to burning enemies."],
    isStarter: true,
    starterFor: "JOEY",
  },
  {
    id: "ARMOR_DOUBLE_MAX",
    isEnabled: true,
    displayName: "100% more Maximum Armor",
    kind: "PASSIVE",
    desc: ["100% more Maximum Armor"],
  },
];

function mapLegacyRelicSuffixToCanonical(suffix: string): string {
  switch (suffix) {
    case "PASS_MOVE_SPEED":
      return "PASS_MOVE_SPEED_20";
    case "PASS_DAMAGE_PERCENT":
      return "PASS_DAMAGE_PERCENT_20";
    case "MOM_DAMAGE_PER_MOMENTUM_5":
      return "MOM_DAMAGE_PER_MOMENTUM_5";
    case "MOM_MOVE_SPEED_PER_MOMENTUM_3":
      return "MOM_MOVE_SPEED_PER_MOMENTUM_3";
    case "MOM_DECAY_DELAY_PLUS_1":
      return "MOM_DECAY_DELAY_PLUS_1";
    case "MOM_MAX_MOMENTUM_PLUS_10":
      return "MOM_MAX_MOMENTUM_PLUS_10";
    case "MOM_PROC_POWER_SCALING_2P":
      return "MOM_PROC_POWER_SCALING_2P";
    case "MOM_BREAK_GRANTS_ARMOR_20":
    case "MOM_FULL_BREAK_GRANTS_ARMOR_20":
      return "MOM_FULL_BREAK_GRANTS_ARMOR_20";
    case "MOM_FULL_CRIT_DOUBLE":
      return "MOM_FULL_CRIT_DOUBLE";
    case "SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40":
      return "SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40";
    case "SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30":
      return "SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30";
    case "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50":
      return "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50";
    case "SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20":
      return "SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20";
    case "ACT_BAZOOKA_ON_HIT_20":
      return "ACT_BAZOOKA_ON_HIT_20";
    case "ACT_EXPLODE_ON_KILL":
      return "ACT_EXPLODE_ON_KILL";
    case "ACT_ALL_HITS_EXPLODE":
    case "ACT_ALL_HITS_EXPLODE_20":
      return "ACT_ALL_HITS_EXPLODE_20";
    case "ACT_TRIGGERS_HAPPEN_TWICE":
    case "ACT_TRIGGERS_DOUBLE":
      return "ACT_TRIGGERS_DOUBLE";
    case "V2_SPARK_ON_HIT":
      return "ACT_SPARK_ON_HIT_20";
    case "ACT_SPARK_ON_HIT_20":
      return "ACT_SPARK_ON_HIT_20";
    case "V2_RETRY_FAILED_PROCS":
      return "ACT_RETRY_FAILED_PROCS_ONCE";
    case "ACT_RETRY_FAILED_PROCS_ONCE":
      return "ACT_RETRY_FAILED_PROCS_ONCE";
    case "V2_PROC_CHANCE_PERCENT":
      return "ACT_PROC_CHANCE_PERCENT_50";
    case "ACT_PROC_CHANCE_PERCENT_50":
      return "ACT_PROC_CHANCE_PERCENT_50";
    case "V2_NOVA_ON_CRIT":
      return "ACT_NOVA_ON_CRIT_FIRE";
    case "ACT_NOVA_ON_CRIT_FIRE":
      return "ACT_NOVA_ON_CRIT_FIRE";
    case "V2_DAGGER_ON_KILL":
      return "ACT_DAGGER_ON_KILL_50";
    case "ACT_DAGGER_ON_KILL_50":
      return "ACT_DAGGER_ON_KILL_50";
    case "V2_IGNITE_SPREAD":
      return "ACT_IGNITE_SPREAD_ON_DEATH";
    case "ACT_IGNITE_SPREAD_ON_DEATH":
      return "ACT_IGNITE_SPREAD_ON_DEATH";
    case "PASS_LUCKY_CRIT":
    case "PASS_CRIT_ROLLS_TWICE":
      return "PASS_CRIT_ROLLS_TWICE";
    case "PASS_DAMAGE_TO_POISON":
    case "PASS_DAMAGE_TO_POISON_ALL":
      return "PASS_DAMAGE_TO_POISON_ALL";
    case "PASS_LIFE_ON_HIT":
    case "PASS_LIFE_ON_HIT_2":
      return "PASS_LIFE_ON_HIT_2";
    case "PASS_DOT_MORE_50":
      return "PASS_DOT_MORE_50";
    case "SPEC_DOT_SPECIALIST":
      return "SPEC_DOT_SPECIALIST";
    case "V3_ARMOR_MAX":
    case "PASS_ARMOR_MAX_50":
      return "ARMOR_MAX_50";
    case "ARMOR_MAX_50":
      return "ARMOR_MAX_50";
    case "ARMOR_RESTORE_ON_KILL_10":
      return "ARMOR_RESTORE_ON_KILL_10";
    case "ARMOR_RESTORE_ON_HIT_1":
      return "ARMOR_RESTORE_ON_HIT_1";
    case "ARMOR_RESTORE_ON_CRIT_5":
      return "ARMOR_RESTORE_ON_CRIT_5";
    case "ARMOR_DOUBLE_MAX":
      return "ARMOR_DOUBLE_MAX";
    default:
      return suffix;
  }
}

export function toCanonicalRelicId(id: string): string {
  if (!id) return id;
  const directMapped = mapLegacyRelicSuffixToCanonical(id);
  if (directMapped !== id) {
    return directMapped;
  }
  if (id.startsWith("RELIC_")) {
    const suffix = id.slice("RELIC_".length);
    const mapped = mapLegacyRelicSuffixToCanonical(suffix);
    return mapped === suffix ? id : mapped;
  }
  return id;
}

export function normalizeRelicIdList(ids: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i++) {
    const canonical = toCanonicalRelicId(ids[i]);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

export function normalizeRelicInstanceList(
  instances: readonly (string | RelicInstance)[] | null | undefined,
  fallbackSource: RelicSource = "drop",
): RelicInstance[] {
  if (!Array.isArray(instances) || instances.length === 0) return [];
  const out: RelicInstance[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < instances.length; i++) {
    const raw = instances[i];
    const canonical =
      typeof raw === "string"
        ? toCanonicalRelicId(raw)
        : toCanonicalRelicId((raw as RelicInstance)?.id ?? "");
    if (!canonical || seen.has(canonical)) continue;
    const source =
      typeof raw === "string"
        ? fallbackSource
        : (((raw as RelicInstance).source ?? fallbackSource) as RelicSource);
    const isLocked =
      (typeof raw === "object" && !!(raw as RelicInstance).isLocked)
      || source === "starter";
    seen.add(canonical);
    out.push({
      id: canonical,
      source,
      isLocked,
    });
  }
  return out;
}

export function getRelicShortDesc(def: RelicDef | null | undefined): string {
  if (!def) return "";
  if (typeof def.shortDesc === "string" && def.shortDesc.trim().length > 0) return def.shortDesc.trim();
  const first = def.desc?.[0] ?? def.longDesc?.[0] ?? "";
  return typeof first === "string" ? first : "";
}

export function getAllRelicIds(): string[] {
  return RELICS.map((relic) => relic.id).sort((a, b) => a.localeCompare(b));
}

export function getRelicById(id: string): RelicDef | null {
  const canonical = toCanonicalRelicId(id);
  return RELICS.find((relic) => relic.id === canonical) ?? null;
}

export function getRelicDef(id: string): RelicDef | undefined {
  return getRelicById(id) ?? undefined;
}

export function relicHasTag(id: string, tag: string): boolean {
  const relic = getRelicById(id);
  if (!relic?.tags?.length) return false;
  return relic.tags.includes(tag);
}

export function hasAnyRelicWithTag(ids: readonly string[], tag: string): boolean {
  for (let i = 0; i < ids.length; i++) {
    if (relicHasTag(ids[i], tag)) return true;
  }
  return false;
}
