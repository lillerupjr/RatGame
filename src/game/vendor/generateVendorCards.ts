import { getEligibleCardPool } from "../combat_mods/rewards/cardPool";

export function generateVendorCards(count: number, characterId?: string): string[] {
  const pool = getEligibleCardPool(characterId);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((c) => c.id);
}
