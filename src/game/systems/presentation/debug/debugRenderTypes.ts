import type { AmbientSunLightingState } from "../../../../shadowSunV1";
import type { DebugOverlayContext } from "../../../../engine/render/debug/renderDebug";
import type { ViewRect } from "../../../map/compile/kenneyMap";
import type {
  PerfOverlayMode,
  StructureTriangleAdmissionMode,
} from "../../../../settings/settingsTypes";
import type { ShadowSunDayCycleDebugStatus } from "../shadowSunDayCycleRuntime";
import type { WorldBatchAudit } from "./worldBatchAudit";

export type ScreenPt = { x: number; y: number };

export type RenderDebugFlags = {
  showGrid: boolean;
  showEntityAnchorOverlay: boolean;
  showWalkMask: boolean;
  showRamps: boolean;
  showOccluders: boolean;
  showDecals: boolean;
  showProjectileFaces: boolean;
  showTriggers: boolean;
  showRoadSemantic: boolean;
  showStructureHeights: boolean;
  showStructureCollision: boolean;
  showStructureSlices: boolean;
  showStructureTriangleFootprint: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSort: boolean;
  perfOverlayMode: PerfOverlayMode;
  showEnemyAimOverlay: boolean;
  showLootGoblinOverlay: boolean;
  showMapOverlays: boolean;
  showZoneObjectiveBounds: boolean;
  showSweepShadowDebug: boolean;
  showTileHeightMap: boolean;
  shadowSunTimeHour: number;
  shadowSunAzimuthDeg: number;
  sunElevationOverrideEnabled: boolean;
  sunElevationOverrideDeg: number;
};

export type RenderDebugFrameContext = {
  enabled: boolean;
  flags: RenderDebugFlags;
};

export type RenderDebugWorldPassInput = {
  ctx: CanvasRenderingContext2D;
  debugContext: DebugOverlayContext;
  viewRect: ViewRect;
  toScreen: (x: number, y: number) => ScreenPt;
  tileWorld: number;
  isTileInRenderRadius: (tx: number, ty: number) => boolean;
  deferredStructureSliceDebugDraws: ReadonlyArray<() => void>;
  flags: RenderDebugFlags;
};

export type ShadowSunDebugModel = {
  timeLabel: string;
  elevationDeg: number;
  directionLabel: string;
  forward: { x: number; y: number; z: number };
  projectionDirection: { x: number; y: number };
  stepKey: string;
};

export type RenderDebugScreenPassInput = {
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  dpr: number;
  flags: RenderDebugFlags;
  fps: number;
  frameTimeMs: number;
  renderPerfCountersEnabled: boolean;
  shadowSunModel: ShadowSunDebugModel;
  ambientSunLighting: AmbientSunLightingState;
  shadowSunDayCycleStatus: ShadowSunDayCycleDebugStatus;
  structureTriangleAdmissionMode: StructureTriangleAdmissionMode;
  sliderPadding: number;
  playerCameraTx: number;
  playerCameraTy: number;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutHalfWidth: number;
  structureTriangleCutoutHalfHeight: number;
  structureTriangleCutoutAlpha: number;
  roadWidthAtPlayer: number;
  worldBatchAudit?: WorldBatchAudit | null;
};
