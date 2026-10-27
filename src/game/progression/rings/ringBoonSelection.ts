// @system   ring-progression/system
// @owns     generate random boon options from a ring's family talent tree
// @doc      docs/canonical/ring_progression_system.md
// @agents   no state mutation or UI; see ringState.ts and boonSelectionMenu.ts

import { getRingFamilyTalentTreeById } from "./ringContent";
import type { RingFamilyId } from "./ringTypes";

export type BoonOption = {
  nodeId: string;
  name: string;
  description: string;
};

export type BoonSelectionContext = {
  ringName: string;
  familyId: string;
  options: BoonOption[];
} | null;

function rngNext(world: any): number {
  if (typeof world?.rng?.float === "function") return world.rng.float();
  if (typeof world?.rng?.next === "function") return world.rng.next();
  return Math.random();
}

function pickUnique<T>(rng: () => number, input: readonly T[], count: number): T[] {
  const source = [...input];
  const out: T[] = [];
  const n = Math.min(count, source.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.min(Math.max(rng(), 0), 0.9999999) * source.length);
    out.push(source[idx]);
    source.splice(idx, 1);
  }
  return out;
}

/** Pick `count` random boons from the family tree, excluding already-unlocked nodes. */
export function generateBoonOptions(
  world: any,
  familyId: RingFamilyId,
  unlockedNodeIds: string[],
  count: number,
): BoonOption[] {
  const tree = getRingFamilyTalentTreeById(familyId);
  if (!tree) return [];

  const unlockedSet = new Set(unlockedNodeIds);
  const available = tree.nodes.filter((node) => !unlockedSet.has(node.id));
  if (available.length === 0) return [];

  const picked = pickUnique(() => rngNext(world), available, count);
  return picked.map((node) => ({
    nodeId: node.id,
    name: node.name,
    description: node.description,
  }));
}
