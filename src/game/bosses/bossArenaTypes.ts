import type { DamageMeta } from "../events";
import type { ArenaCell, BossArena } from "./bossArena";
import type { AnimatedSurfaceId } from "../systems/presentation/animatedSurfaces/animatedSurfaceTypes";

export const ArenaPatternKind = {
  CHECKERBOARD: "checkerboard",
  SNAKE: "snake",
  INWARD_COLLAPSE: "inward_collapse",
} as const;

export type ArenaPatternKind = (typeof ArenaPatternKind)[keyof typeof ArenaPatternKind];

export type CheckerboardPatternParams = {
  parity: 0 | 1;
};

export type SnakePatternParams = {
  bandHeightCells: number;
  segmentWidthCells: number;
  horizontalStepCells: number;
  startX: number;
  initialDirection: "left" | "right";
};

export type InwardCollapsePatternParams = {
  ringIndex: number;
  ringWidthCells: number;
};

export type ArenaActionPatternParams =
  | CheckerboardPatternParams
  | SnakePatternParams
  | InwardCollapsePatternParams;

export type ArenaActionSpec = {
  id: string;
  patternKind: ArenaPatternKind;
  patternParams: ArenaActionPatternParams;
  startAtSec: number;
  warningSec: number;
  activeSec: number;
  effectKind: "hazard";
  damagePlayer: number;
  tickEverySec: number;
  surfaceId?: AnimatedSurfaceId;
};

export type BossArenaActionPhase = "PENDING" | "WARNING" | "ACTIVE" | "DONE";

export type BossArenaActionRuntimeState = {
  spec: ArenaActionSpec;
  selectedCells: ArenaCell[];
  selectedTiles: Array<{ tx: number; ty: number }>;
  effectIds: string[];
  phase: BossArenaActionPhase;
  damageMeta?: DamageMeta;
};

export type BossArenaSequenceRuntimeState = {
  arena: BossArena;
  actions: BossArenaActionRuntimeState[];
};
