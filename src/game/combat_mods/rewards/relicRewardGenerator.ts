import { getAllRelicIds, getRelicById } from "../../content/relics";

export function generateRelicRewardOptions(
  rng: () => number,
  count: number,
  excludeIds: readonly string[] = [],
): string[] {
  const excluded = new Set(excludeIds);
  const all = getAllRelicIds().filter(
    (id) => {
      const relic = getRelicById(id);
      if (!relic || !relic.isEnabled) return false;
      if (relic.isStarter) return false;
      return !excluded.has(id);
    },
  );
  if (all.length === 0 || count <= 0) return [];

  const picked = new Set<string>();
  while (picked.size < count && picked.size < all.length) {
    const idx = Math.floor(Math.max(0, Math.min(0.999999999, rng())) * all.length);
    picked.add(all[idx]);
  }
  return Array.from(picked);
}
