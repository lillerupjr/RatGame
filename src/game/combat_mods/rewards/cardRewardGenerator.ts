import { getEligibleCardPool } from "./cardPool";
import type { CardDef } from "../stats/modifierTypes";
import { CARD_TIER_WEIGHTS } from "./cardTierWeights";

/**
 * Deterministically select N unique cards using two-stage tiered selection:
 * 1) pick tier by weights
 * 2) pick card uniformly from that tier
 */
export function generateCardRewardOptions(
  rng: () => number,
  count: number,
  characterId?: string,
): string[] {
  const cards = getEligibleCardPool(characterId);
  const byTier = buildTierMap(cards);
  const picked = new Set<string>();
  const out: string[] = [];

  const max = Math.min(Math.max(0, count), cards.length);
  for (let i = 0; i < max; i++) {
    const tier = pickTier(rng, byTier, picked);
    if (!tier) break;
    const options = byTier[tier].filter((id) => !picked.has(id));
    if (options.length === 0) break;
    const idx = pickIndex(rng, options.length);
    const id = options[idx];
    picked.add(id);
    out.push(id);
  }

  return out;
}

function buildTierMap(cards: CardDef[]): Record<1 | 2 | 3 | 4 | 5, string[]> {
  const map: Record<1 | 2 | 3 | 4 | 5, string[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };
  for (const c of cards) {
    map[c.powerTier].push(c.id);
  }
  return map;
}

function pickTier(
  rng: () => number,
  byTier: Record<1 | 2 | 3 | 4 | 5, string[]>,
  picked: ReadonlySet<string>
): 1 | 2 | 3 | 4 | 5 | null {
  const tiers: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
  let totalWeight = 0;
  const availableWeights = new Map<1 | 2 | 3 | 4 | 5, number>();

  for (const tier of tiers) {
    const remaining = byTier[tier].some((id) => !picked.has(id));
    const weight = remaining ? Math.max(0, CARD_TIER_WEIGHTS[tier]) : 0;
    availableWeights.set(tier, weight);
    totalWeight += weight;
  }

  if (totalWeight <= 0) return null;

  let roll = rng() * totalWeight;
  for (const tier of tiers) {
    const weight = availableWeights.get(tier) ?? 0;
    if (weight <= 0) continue;
    if (roll < weight) return tier;
    roll -= weight;
  }

  return tiers.find((tier) => (availableWeights.get(tier) ?? 0) > 0) ?? null;
}

function pickIndex(rng: () => number, len: number): number {
  if (len <= 1) return 0;
  const v = Math.max(0, Math.min(0.999999999, rng()));
  return Math.floor(v * len);
}
