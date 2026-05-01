import type { EnemyId } from "../content/enemies";

export type HostileStatsConfig = {
  baseLife: number;
  contactDamage: number;
};

export type HostileBodyConfig = {
  radius: number;
  hitHeightProjectile?: number;
  hitHeightContact?: number;
};

export type HostileRewardsConfig = {
  goldValue?: number;
  goldMultiplier?: number;
  isBoss?: boolean;
};

export type HostileSpriteConfig = {
  skin: string;
  scale: number;
  anchorX: number;
  anchorY: number;
  frameW: number;
  frameH: number;
  runAnim?: string;
  castAnim?: string;
  frameCount?: number;
  packRoot?: string;
};

export type HostilePresentationConfig = {
  color?: string;
  sprite?: HostileSpriteConfig;
  aimScreenOffset?: { x: number; y: number };
  shadowFootOffset?: { x: number; y: number };
};

export type HostileMovementConfig = {
  mode: "approach_player" | "scripted";
  speed: number;
  desiredRange: number;
  tolerance: number;
  reengageRange: number;
};

export type HostileRadialProjectileDeathEffectConfig = {
  type: "radial_projectiles";
  count: number;
  projectileKind: number;
  speed: number;
  damage: number;
  ttl: number;
};

export type HostileSplitIntoChildrenDeathEffectConfig = {
  type: "split_into_children";
  childCount: number;
  childTypeId?: EnemyId;
  maxSplitStage: number;
  spreadRadius?: number;
  separationImpulse?: number;
};

export type HostileDeathEffectConfig =
  | HostileRadialProjectileDeathEffectConfig
  | HostileSplitIntoChildrenDeathEffectConfig;

export type SharedHostileDefinition = {
  name: string;
  stats: HostileStatsConfig;
  body: HostileBodyConfig;
  rewards?: HostileRewardsConfig;
  presentation?: HostilePresentationConfig;
  movement: HostileMovementConfig;
  deathEffects?: HostileDeathEffectConfig[];
};
