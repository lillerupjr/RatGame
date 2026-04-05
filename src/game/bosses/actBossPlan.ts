import { getAuthoredMapDefByMapId } from "../map/authored/authoredMapRegistry";
import { RNG } from "../util/rng";
import { BossId, type BossId as BossIdType } from "./bossTypes";

export const ACT_BOSS_MAP_OVERRIDE: string | null = null;

export const ACT_BOSS_POOL: Array<{ bossId: BossIdType; weight: number }> = [
  { bossId: BossId.RAT_KING, weight: 1 },
];

export const ACT_BOSS_MAP_POOL: Array<{ mapId: string; weight: number }> = [
  { mapId: "BOSS1", weight: 1 },
];

export type ActBossPlan = {
  bossId: BossIdType;
  mapId: string;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function weightedPick<T extends { weight: number }>(rng: RNG, entries: readonly T[]): T {
  if (entries.length <= 0) {
    throw new Error("weightedPick requires at least one entry");
  }
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += Math.max(0, entries[i].weight);
  if (total <= 0) return entries[0];

  let roll = rng.range(0, total);
  for (let i = 0; i < entries.length; i++) {
    roll -= Math.max(0, entries[i].weight);
    if (roll <= 0) return entries[i];
  }
  return entries[entries.length - 1];
}

export function resolveActBossMapOverride(raw: string | null = ACT_BOSS_MAP_OVERRIDE): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return getAuthoredMapDefByMapId(trimmed)?.id ?? null;
}

export function buildActBossPlan(
  seed: number,
  depth: number,
  rawMapOverride: string | null = ACT_BOSS_MAP_OVERRIDE,
): ActBossPlan {
  const rng = new RNG(hashString(`${seed}:${depth}:ACT_BOSS`));
  const bossId = weightedPick(rng, ACT_BOSS_POOL).bossId;
  const overrideMapId = resolveActBossMapOverride(rawMapOverride);
  const mapId = overrideMapId ?? weightedPick(rng, ACT_BOSS_MAP_POOL).mapId;
  return { bossId, mapId };
}
