export function goldValueFromEnemyMaxHp(enemyMaxHp: number): number {
  const hp = Number.isFinite(enemyMaxHp) ? Math.max(1, enemyMaxHp) : 1;
  // Baseline tuning: roughly +1 gold per 25 enemy max HP.
  return Math.max(1, Math.round(hp / 25));
}

const COIN_TIER_COLORS = [
  "#b87333", // copper
  "#c0c0c0", // silver
  "#ffd700", // gold
  "#8ecae6", // platinum
  "#67e8f9", // diamond
  "#a855f7", // purple
] as const;

export function coinColorFromValue(value: number): string {
  const v = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  if (v <= 1) return COIN_TIER_COLORS[0];
  if (v <= 2) return COIN_TIER_COLORS[1];
  if (v <= 4) return COIN_TIER_COLORS[2];
  if (v <= 8) return COIN_TIER_COLORS[3];
  if (v <= 16) return COIN_TIER_COLORS[4];
  if (v <= 32) return COIN_TIER_COLORS[5];

  // Beyond purple, continue chroma progression by rotating hue.
  const tier = Math.floor(Math.log2(v));
  const extra = Math.max(0, tier - 5);
  const hue = (280 + extra * 28) % 360;
  return `hsl(${hue} 90% 62%)`;
}
