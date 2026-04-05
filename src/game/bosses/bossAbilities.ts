export const BossAbilityId = {
  TOXIC_DROP_MARKER: "toxic_drop_marker",
  CHECKERBOARD_IGNITION: "checkerboard_ignition",
} as const;

export type BossAbilityId = (typeof BossAbilityId)[keyof typeof BossAbilityId];

export type BossAbilityKind =
  | "boss_cast"
  | "world_cast"
  | "target_cast"
  | "hybrid_cast";

export type BossAbilityPhase =
  | "TELEGRAPH"
  | "ACTIVE"
  | "RESOLVE"
  | "COOLDOWN";

export type BossAnimationHookSet = {
  castStart?: string;
  loop?: string;
  resolve?: string;
};

type BossAbilityBaseDefinition = {
  id: BossAbilityId;
  kind: BossAbilityKind;
  attackId: string;
  telegraphSec: number;
  activeSec: number;
  resolveSec: number;
  cooldownSec: number;
  animation?: BossAnimationHookSet;
};

export type BossToxicDropMarkerAbilityDefinition = BossAbilityBaseDefinition & {
  kind: "target_cast";
  pattern: "toxic_drop_marker";
  damage: number;
  tickEverySec: number;
};

export type BossCheckerboardIgnitionAbilityDefinition = BossAbilityBaseDefinition & {
  kind: "world_cast";
  pattern: "checkerboard_ignition";
  damage: number;
  tickEverySec: number;
  footprintHalfWidthTiles: number;
  footprintHalfHeightTiles: number;
};

export type BossAbilityDefinition =
  | BossToxicDropMarkerAbilityDefinition
  | BossCheckerboardIgnitionAbilityDefinition;

export const BOSS_ABILITIES: Record<BossAbilityId, BossAbilityDefinition> = {
  [BossAbilityId.TOXIC_DROP_MARKER]: {
    id: BossAbilityId.TOXIC_DROP_MARKER,
    kind: "target_cast",
    pattern: "toxic_drop_marker",
    attackId: "TOXIC_DROP_MARKER",
    telegraphSec: 0.8,
    activeSec: 1.6,
    resolveSec: 0.15,
    cooldownSec: 2.4,
    animation: {
      castStart: "cast_start",
      resolve: "cast_resolve",
    },
    damage: 9,
    tickEverySec: 0.25,
  },
  [BossAbilityId.CHECKERBOARD_IGNITION]: {
    id: BossAbilityId.CHECKERBOARD_IGNITION,
    kind: "world_cast",
    pattern: "checkerboard_ignition",
    attackId: "CHECKERBOARD_IGNITION",
    telegraphSec: 1.0,
    activeSec: 1.5,
    resolveSec: 0.15,
    cooldownSec: 3.0,
    animation: {
      castStart: "cast_start",
      resolve: "cast_resolve",
    },
    damage: 5,
    tickEverySec: 0.35,
    footprintHalfWidthTiles: 6,
    footprintHalfHeightTiles: 6,
  },
};
