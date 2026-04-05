import { PRJ_KIND } from "../factories/projectileFactory";

export const BossAbilityId = {
  RAT_KING_FAN: "RAT_KING_FAN",
  RAT_KING_PUDDLE: "RAT_KING_PUDDLE",
} as const;

export type BossAbilityId = (typeof BossAbilityId)[keyof typeof BossAbilityId];

export type BossProjectileFanAbilityDefinition = {
  id: BossAbilityId;
  kind: "projectile_fan";
  attackId: string;
  projectileKind: number;
  projectileCount: number;
  spreadDeg: number;
  speed: number;
  damage: number;
  radius: number;
  ttl: number;
  cooldownSec: number;
};

export type BossHazardPuddleAbilityDefinition = {
  id: BossAbilityId;
  kind: "hazard_puddle";
  attackId: string;
  radius: number;
  damage: number;
  tickEvery: number;
  ttl: number;
  cooldownSec: number;
  minOffset: number;
  maxOffset: number;
};

export type BossAbilityDefinition =
  | BossProjectileFanAbilityDefinition
  | BossHazardPuddleAbilityDefinition;

export const BOSS_ABILITIES: Record<BossAbilityId, BossAbilityDefinition> = {
  [BossAbilityId.RAT_KING_FAN]: {
    id: BossAbilityId.RAT_KING_FAN,
    kind: "projectile_fan",
    attackId: "RAT_KING_FAN",
    projectileKind: PRJ_KIND.DAGGER,
    projectileCount: 5,
    spreadDeg: 38,
    speed: 260,
    damage: 12,
    radius: 8,
    ttl: 1.4,
    cooldownSec: 2.2,
  },
  [BossAbilityId.RAT_KING_PUDDLE]: {
    id: BossAbilityId.RAT_KING_PUDDLE,
    kind: "hazard_puddle",
    attackId: "RAT_KING_PUDDLE",
    radius: 72,
    damage: 7,
    tickEvery: 0.22,
    ttl: 4.5,
    cooldownSec: 4.5,
    minOffset: 70,
    maxOffset: 180,
  },
};
