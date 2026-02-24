export type EnemyPowerTier = "trash" | "elite" | "tank" | "ranged" | "swarm";

export interface EnemyPowerCostConfig {
  costs: Record<EnemyPowerTier, number>;
  hpWeight: Record<EnemyPowerTier, number>;
}

export function defaultEnemyPowerCostConfig(): EnemyPowerCostConfig {
  return {
    costs: {
      trash: 1.0,
      elite: 2.0,
      tank: 4.0,
      ranged: 0.9,
      swarm: 0.6,
    },
    hpWeight: {
      trash: 1.0,
      elite: 1.0,
      tank: 1.0,
      ranged: 1.0,
      swarm: 1.0,
    },
  };
}

