export const GOLD_PER_HP = 0.05;
export const BOSS_GOLD_MULTIPLIER = 2;
export const GOLD_COIN_COLOR = "#ffd700";

export function baseGoldFromEnemyBaseLife(baseLife: number): number {
  const life = Number.isFinite(baseLife) ? Math.max(0, baseLife) : 0;
  return Math.max(1, Math.floor(life * GOLD_PER_HP));
}

export function goldValueFromEnemyBaseLife(
  baseLife: number,
  options?: { isBoss?: boolean; multiplier?: number }
): number {
  let gold = baseGoldFromEnemyBaseLife(baseLife);
  if (options?.isBoss) gold *= BOSS_GOLD_MULTIPLIER;
  if (Number.isFinite(options?.multiplier)) {
    gold *= Math.max(0, options?.multiplier ?? 1);
  }
  return Math.max(1, Math.floor(gold));
}

export function coinColorFromValue(_value: number): string {
  return GOLD_COIN_COLOR;
}
