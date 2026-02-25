export type RelicDef = {
  id: string;
  isEnabled: boolean;
  displayName: string;
  kind: "PASSIVE" | "ACTIVE";
  tags?: string[];
  desc?: string[];
};

export const RELICS: RelicDef[] = [
  {
    id: "PASS_MOVE_SPEED_20",
    isEnabled: true,
    displayName: "+20% movement speed",
    kind: "PASSIVE",
    desc: ["+20% movement speed"],
  },
  {
    id: "PASS_DAMAGE_PERCENT_20",
    isEnabled: true,
    displayName: "+20% damage",
    kind: "PASSIVE",
    desc: ["Deal 20% more damage"],
  },
  {
    id: "PASS_LIFE_TO_DAMAGE_2P",
    isEnabled: true,
    displayName: "Gain damage equal to 2% max life",
    kind: "PASSIVE",
  },
  {
    id: "ACT_MISSILE_ON_HIT_20",
    isEnabled: true,
    displayName: "On hit: 20% chance to fire missile",
    kind: "ACTIVE",
    desc: ["On hit: 20% chance to fire a homing missile"],
  },
  {
    id: "ACT_BAZOOKA_ON_HIT_20",
    isEnabled: true,
    displayName: "On hit: fire bazooka dealing 20% damage",
    kind: "ACTIVE",
    desc: ["On hit: fire bazooka dealing 20% damage"],
  },
  {
    id: "ACT_EXPLODE_ON_KILL",
    isEnabled: true,
    displayName: "On kill: enemies explode",
    kind: "ACTIVE",
    desc: ["On kill: enemies explode"],
  },
];

function mapLegacyRelicSuffixToCanonical(suffix: string): string {
  switch (suffix) {
    case "PASS_MOVE_SPEED":
      return "PASS_MOVE_SPEED_20";
    case "PASS_DAMAGE_PERCENT":
      return "PASS_DAMAGE_PERCENT_20";
    case "ACT_MISSILE_ON_HIT":
      return "ACT_MISSILE_ON_HIT_20";
    case "ACT_BAZOOKA_ON_HIT_20":
      return "ACT_BAZOOKA_ON_HIT_20";
    case "ACT_EXPLODE_ON_KILL":
      return "ACT_EXPLODE_ON_KILL";
    case "ACT_TRIGGERS_HAPPEN_TWICE":
      return "ACT_TRIGGERS_DOUBLE";
    case "V3_ARMOR_MAX":
      return "PASS_ARMOR_MAX_50";
    default:
      return suffix;
  }
}

export function toCanonicalRelicId(id: string): string {
  if (!id) return id;
  if (id.startsWith("RELIC_")) {
    return mapLegacyRelicSuffixToCanonical(id.slice("RELIC_".length));
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
