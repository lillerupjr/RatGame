import type { World } from "../../../engine/world/world";
import type { RelicInstance, RelicSource } from "../../content/relics";
import {
  normalizeRelicIdList,
  normalizeRelicInstanceList,
  toCanonicalRelicId,
} from "../../content/relics";
import { recomputeDerivedStats } from "../../stats/derivedStats";

export type ApplyRelicOptions = {
  source?: RelicSource;
  isLocked?: boolean;
};

export type RemoveRelicResult = {
  removed: boolean;
  reason?: "NOT_FOUND" | "LOCKED";
};

function cloneInstances(instances: readonly RelicInstance[]): RelicInstance[] {
  const out: RelicInstance[] = [];
  for (let i = 0; i < instances.length; i++) {
    const it = instances[i];
    out.push({
      id: it.id,
      source: it.source,
      isLocked: !!it.isLocked || it.source === "starter",
    });
  }
  return out;
}

function areRelicIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areRelicInstancesEqual(a: readonly RelicInstance[], b: readonly RelicInstance[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    if ((a[i].source ?? "drop") !== (b[i].source ?? "drop")) return false;
    if (!!a[i].isLocked !== !!b[i].isLocked) return false;
  }
  return true;
}

function buildNormalizedRelicInstances(world: World): RelicInstance[] {
  const normalizedIds = normalizeRelicIdList(world.relics ?? []);
  const normalizedInstances = normalizeRelicInstanceList(world.relicInstances ?? [], "drop");
  const byId = new Map<string, RelicInstance>();

  for (let i = 0; i < normalizedInstances.length; i++) {
    const it = normalizedInstances[i];
    byId.set(it.id, {
      id: it.id,
      source: it.source ?? "drop",
      isLocked: !!it.isLocked || it.source === "starter",
    });
  }

  for (let i = 0; i < normalizedIds.length; i++) {
    const id = normalizedIds[i];
    if (byId.has(id)) continue;
    byId.set(id, { id, source: "drop", isLocked: false });
  }

  const out: RelicInstance[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < normalizedInstances.length; i++) {
    const id = normalizedInstances[i].id;
    if (seen.has(id)) continue;
    seen.add(id);
    const it = byId.get(id);
    if (!it) continue;
    out.push({
      id: it.id,
      source: it.source ?? "drop",
      isLocked: !!it.isLocked || it.source === "starter",
    });
  }

  for (let i = 0; i < normalizedIds.length; i++) {
    const id = normalizedIds[i];
    if (seen.has(id)) continue;
    seen.add(id);
    const it = byId.get(id);
    if (!it) continue;
    out.push({
      id: it.id,
      source: it.source ?? "drop",
      isLocked: !!it.isLocked || it.source === "starter",
    });
  }

  return out;
}

function canRecomputeDerivedStats(world: World): boolean {
  const w = world as unknown as Record<string, unknown>;
  return (
    Array.isArray(w.items) &&
    Array.isArray(w.cards) &&
    typeof w.baseMoveSpeed === "number" &&
    typeof w.basePickupRadius === "number" &&
    typeof w.basePlayerHpMax === "number" &&
    typeof w.playerHp === "number"
  );
}

function primeDerivedStatsDefaults(world: World): void {
  const w = world as unknown as Record<string, unknown>;
  if (!Array.isArray(w.items)) w.items = [];
  if (!Array.isArray(w.cards)) w.cards = [];
  if (typeof w.baseMoveSpeed !== "number") {
    w.baseMoveSpeed = typeof w.pSpeed === "number" ? (w.pSpeed as number) : 0;
  }
  if (typeof w.basePickupRadius !== "number") {
    w.basePickupRadius = typeof w.pickupRadius === "number" ? (w.pickupRadius as number) : 0;
  }
  if (typeof w.basePlayerHpMax !== "number") {
    w.basePlayerHpMax =
      typeof w.playerHpMax === "number"
        ? (w.playerHpMax as number)
        : (typeof w.playerHp === "number" ? (w.playerHp as number) : 1);
  }
  if (typeof w.playerHpMax !== "number") {
    w.playerHpMax = w.basePlayerHpMax as number;
  }
  if (typeof w.playerHp !== "number") {
    w.playerHp = w.playerHpMax as number;
  }
  if (typeof w.currentArmor !== "number") w.currentArmor = 0;
  if (typeof w.momentumValue !== "number") w.momentumValue = 0;
}

export function normalizeWorldRelics(world: World): void {
  const normalizedInstances = buildNormalizedRelicInstances(world);
  const normalizedIds = normalizedInstances.map((it) => it.id);
  if (!areRelicInstancesEqual(normalizedInstances, world.relicInstances ?? [])) {
    world.relicInstances = cloneInstances(normalizedInstances);
  }
  if (!areRelicIdsEqual(normalizedIds, world.relics ?? [])) {
    world.relics = [...normalizedIds];
  }
}

export function getWorldRelicInstances(world: World): RelicInstance[] {
  normalizeWorldRelics(world);
  return cloneInstances(world.relicInstances ?? []);
}

export function setWorldRelicInstances(world: World, instances: readonly RelicInstance[]): void {
  const normalized = normalizeRelicInstanceList(instances, "drop");
  world.relicInstances = normalized;
  world.relics = normalized.map((it) => it.id);
  normalizeWorldRelics(world);
  primeDerivedStatsDefaults(world);
  if (canRecomputeDerivedStats(world)) {
    recomputeDerivedStats(world);
  }
}

export function applyRelic(world: World, relicId: string, options?: ApplyRelicOptions): boolean {
  normalizeWorldRelics(world);
  const canonical = toCanonicalRelicId(relicId);
  if (!canonical) return false;
  if (world.relics.includes(canonical)) return false;
  const source = options?.source ?? "drop";
  const isLocked = options?.isLocked ?? source === "starter";
  const nextInstances = getWorldRelicInstances(world);
  nextInstances.push({
    id: canonical,
    source,
    isLocked: !!isLocked || source === "starter",
  });
  setWorldRelicInstances(world, nextInstances);
  return true;
}

export function setRelicMetadata(
  world: World,
  relicId: string,
  options: ApplyRelicOptions,
): boolean {
  normalizeWorldRelics(world);
  const canonical = toCanonicalRelicId(relicId);
  if (!canonical) return false;
  const nextInstances = getWorldRelicInstances(world);
  const idx = nextInstances.findIndex((it) => it.id === canonical);
  if (idx < 0) return false;
  const prev = nextInstances[idx];
  const source = options.source ?? prev.source ?? "drop";
  const isLocked = options.isLocked ?? prev.isLocked ?? source === "starter";
  nextInstances[idx] = {
    id: prev.id,
    source,
    isLocked: !!isLocked || source === "starter",
  };
  setWorldRelicInstances(world, nextInstances);
  return true;
}

export function removeRelic(world: World, relicId: string): RemoveRelicResult {
  normalizeWorldRelics(world);
  const canonical = toCanonicalRelicId(relicId);
  if (!canonical) return { removed: false, reason: "NOT_FOUND" };
  const nextInstances = getWorldRelicInstances(world);
  const idx = nextInstances.findIndex((it) => it.id === canonical);
  if (idx < 0) return { removed: false, reason: "NOT_FOUND" };
  const instance = nextInstances[idx];
  if (instance.source === "starter" || instance.isLocked) {
    return { removed: false, reason: "LOCKED" };
  }
  nextInstances.splice(idx, 1);
  setWorldRelicInstances(world, nextInstances);
  return { removed: true };
}

export type RelicMods = {
  moveSpeedMult?: number;
  dmgMult?: number;
  hitDamageMoreMult?: number;
  dotDamageMoreMult?: number;
  critRolls?: 1 | 2;
  moreDamage?: number;
  lessDamage?: number;
  moreAttackSpeed?: number;
  lessAttackSpeed?: number;
  lessMaxLife?: number;
  flatMaxArmor?: number;
  lessMoveSpeed?: number;
};

export function getRelicMods(world: World): RelicMods {
  normalizeWorldRelics(world);
  const hasMoveRelic = world.relics.includes("PASS_MOVE_SPEED_20");
  const hasLuckyCrit = world.relics.includes("PASS_CRIT_ROLLS_TWICE");
  const hasSpecDamageMore100AttackLess40 = world.relics.includes("SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40");
  const hasSpecAttackMore50DamageLess30 = world.relics.includes("SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30");
  const hasSpecDamageMore200LifeLess50 = world.relics.includes("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");
  const hasSpecArmor100MoveLess20 = world.relics.includes("SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20");
  const hasPassDotMore50 = world.relics.includes("PASS_DOT_MORE_50");
  const hasSpecDotSpecialist = world.relics.includes("SPEC_DOT_SPECIALIST");
  return {
    moveSpeedMult: hasMoveRelic ? 1.2 : 1,
    dmgMult: 1,
    hitDamageMoreMult: hasSpecDotSpecialist ? 0.5 : 1,
    dotDamageMoreMult: (hasPassDotMore50 ? 1.5 : 1) * (hasSpecDotSpecialist ? 3.0 : 1),
    critRolls: hasLuckyCrit ? 2 : 1,
    moreDamage:
      (hasSpecDamageMore100AttackLess40 ? 1.0 : 0) +
      (hasSpecDamageMore200LifeLess50 ? 2.0 : 0),
    lessDamage: hasSpecAttackMore50DamageLess30 ? 0.3 : 0,
    moreAttackSpeed: hasSpecAttackMore50DamageLess30 ? 0.5 : 0,
    lessAttackSpeed: hasSpecDamageMore100AttackLess40 ? 0.3 : 0,
    lessMaxLife: hasSpecDamageMore200LifeLess50 ? 0.5 : 0,
    flatMaxArmor: hasSpecArmor100MoveLess20 ? 100 : 0,
    lessMoveSpeed: hasSpecArmor100MoveLess20 ? 0.2 : 0,
  };
}
