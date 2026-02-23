import { expectedDpsAtProgress, type ExpectedPowerConfig } from "./expectedPower";
import type { EnemyPowerCostConfig, EnemyPowerTier } from "./enemyPower";

export function computeSpawnHpFromPower(
  expectedCfg: ExpectedPowerConfig,
  powerCfg: EnemyPowerCostConfig,
  tSec: number,
  depth: number,
  tier: EnemyPowerTier
): number {
  const expectedDps = expectedDpsAtProgress(expectedCfg, tSec, depth);
  const cost = powerCfg.costs[tier] ?? 1;
  const w = powerCfg.hpWeight[tier] ?? 1;
  const hp = expectedDps * cost * w;
  return Math.max(1, Math.round(hp));
}

