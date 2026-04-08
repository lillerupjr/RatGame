import type { ArenaActionSpec } from "./bossArenaTypes";
import { ArenaPatternKind } from "./bossArenaTypes";
import { AnimatedSurfaceId } from "../content/animatedSurfaceRegistry";

export const BossAbilityId = {
  TOXIC_DROP_MARKER: "toxic_drop_marker",
  CHECKERBOARD_IGNITION: "checkerboard_ignition",
  POISON_FLAMETHROWER: "poison_flamethrower",
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
  burstCount: number;
  burstSpacingSec: number;
};

export type BossCheckerboardIgnitionAbilityDefinition = BossAbilityBaseDefinition & {
  kind: "world_cast";
  pattern: "checkerboard_ignition";
  patternSequence: ArenaActionSpec[];
};

export type BossPoisonFlamethrowerAbilityDefinition = BossAbilityBaseDefinition & {
  kind: "boss_cast";
  pattern: "poison_flamethrower";
  maxRangePx: number;
  widthPx: number;
  visualScale: number;
  damagePerTick: number;
  tickEverySec: number;
  loopVfxId: string;
  endingVfxId: string;
};

export type BossAbilityDefinition =
  | BossToxicDropMarkerAbilityDefinition
  | BossCheckerboardIgnitionAbilityDefinition
  | BossPoisonFlamethrowerAbilityDefinition;

export const BOSS_ABILITIES: Record<BossAbilityId, BossAbilityDefinition> = {
  [BossAbilityId.TOXIC_DROP_MARKER]: {
    id: BossAbilityId.TOXIC_DROP_MARKER,
    kind: "target_cast",
    pattern: "toxic_drop_marker",
    attackId: "TOXIC_DROP_MARKER",
    telegraphSec: 0.5,
    activeSec: 1.5,
    resolveSec: 0.15,
    cooldownSec: 2.4,
    animation: {
      castStart: "cast_start",
      resolve: "cast_resolve",
    },
    damage: 20,
    burstCount: 3,
    burstSpacingSec: 0.75,
  },
  [BossAbilityId.CHECKERBOARD_IGNITION]: {
    id: BossAbilityId.CHECKERBOARD_IGNITION,
    kind: "world_cast",
    pattern: "checkerboard_ignition",
    attackId: "CHECKERBOARD_IGNITION",
    telegraphSec: 0.75,
    activeSec: 7.35,
    resolveSec: 0.15,
    cooldownSec: 3.0,
    animation: {
      castStart: "cast_start",
      resolve: "cast_resolve",
    },
    patternSequence: [
      {
        id: "checkerboard",
        patternKind: ArenaPatternKind.CHECKERBOARD,
        patternParams: { parity: 0 },
        startAtSec: 0.0,
        warningSec: 0.75,
        activeSec: 0.75,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      },
      {
        id: "snake",
        patternKind: ArenaPatternKind.SNAKE,
        patternParams: {
          bandHeightCells: 2,
          segmentWidthCells: 7,
          horizontalStepCells: 4,
          startX: 0,
          initialDirection: "right",
        },
        startAtSec: 1.65,
        warningSec: 0.75,
        activeSec: 0.75,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      },
      {
        id: "inward_collapse_0",
        patternKind: ArenaPatternKind.INWARD_COLLAPSE,
        patternParams: { ringIndex: 0, ringWidthCells: 3 },
        startAtSec: 3.3,
        warningSec: 0.75,
        activeSec: 0.75,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      },
      {
        id: "inward_collapse_1",
        patternKind: ArenaPatternKind.INWARD_COLLAPSE,
        patternParams: { ringIndex: 1, ringWidthCells: 3 },
        startAtSec: 4.95,
        warningSec: 0.75,
        activeSec: 0.75,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      },
      {
        id: "inward_collapse_2",
        patternKind: ArenaPatternKind.INWARD_COLLAPSE,
        patternParams: { ringIndex: 2, ringWidthCells: 3 },
        startAtSec: 6.6,
        warningSec: 0.75,
        activeSec: 0.75,
        effectKind: "hazard",
        damagePlayer: 5,
        tickEverySec: 0.1,
        surfaceId: AnimatedSurfaceId.TOXIC_POISON_SURFACE,
      },
    ],
  },
  [BossAbilityId.POISON_FLAMETHROWER]: {
    id: BossAbilityId.POISON_FLAMETHROWER,
    kind: "boss_cast",
    pattern: "poison_flamethrower",
    attackId: "POISON_FLAMETHROWER",
    telegraphSec: 0,
    activeSec: 1.2,
    resolveSec: 0.35,
    cooldownSec: 2.8,
    animation: {
      loop: "cast_loop",
      resolve: "cast_resolve",
    },
    maxRangePx: 320,
    widthPx: 40,
    visualScale: 5.1,
    damagePerTick: 10,
    tickEverySec: 0.2,
    loopVfxId: "CHEM_GUY_FLAMETHROWER_LOOP",
    endingVfxId: "CHEM_GUY_FLAMETHROWER_END",
  },
};
