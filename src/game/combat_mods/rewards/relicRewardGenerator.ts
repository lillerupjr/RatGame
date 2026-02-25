import { getAllRelicIds, getRelicById } from "../../content/relics";

export function generateRelicRewardOptions(rng: () => number, count: number): string[] {
  const all = getAllRelicIds().filter((id) => getRelicById(id)?.isEnabled === true);
  if (all.length === 0 || count <= 0) return [];

  const picked = new Set<string>();
  while (picked.size < count && picked.size < all.length) {
    const idx = Math.floor(Math.max(0, Math.min(0.999999999, rng())) * all.length);
    picked.add(all[idx]);
  }
  return Array.from(picked);
}
