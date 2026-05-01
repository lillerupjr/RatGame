import type { DecalPiece, Surface } from "../../map/compile/kenneyMap";
import type { RuntimeDecalSetId } from "../../content/runtimeDecalConfig";
import type {
  GroundDecalQuadPayload,
  GroundSurfaceQuadPayload,
} from "./contracts/renderCommands";
import type { StaticAtlasFrame, StaticAtlasProjectedDecalLookup } from "./staticAtlasStore";
import {
  buildFlatTileDestinationQuad,
  buildGroundDecalProjectedSurfacePayload,
  buildProjectedSurfacePayload,
  type RenderQuadPoints,
} from "./renderCommandGeometry";
import { countRenderStaticAtlasFallback } from "./renderPerfCounters";
import { KindOrder, type RenderKey } from "./worldRenderOrdering";

type ReadyImageRecord = {
  ready?: boolean;
  img?: HTMLImageElement | null;
} | null;

const LOGICAL_GROUND_SURFACE_ANCHOR_Y = 0.5;

type GroundResolvedCommandBase<TFamily extends "groundSurface" | "groundDecal", TPayload> = {
  key: RenderKey;
  stableId: number;
  tx: number;
  ty: number;
  semanticFamily: TFamily;
  finalForm: "quad";
  payload: TPayload;
  destinationQuad: RenderQuadPoints;
};

export type ResolvedGroundSurfaceProjectedCommand = GroundResolvedCommandBase<
  "groundSurface",
  GroundSurfaceQuadPayload
>;

export type ResolvedGroundDecalProjectedCommand = GroundResolvedCommandBase<
  "groundDecal",
  GroundDecalQuadPayload
>;

export type ResolvedGroundProjectedCommand =
  | ResolvedGroundSurfaceProjectedCommand
  | ResolvedGroundDecalProjectedCommand;

export type GroundCommandResolverDeps = {
  w: { timeSec?: number; time?: number };
  ANCHOR_Y: number;
  TILE_ID_OCEAN: string;
  getAnimatedTileFrame: (setId: "water1" | "water2", timeSec: number) => ReadyImageRecord;
  OCEAN_ANIM_TIME_SCALE: number;
  getTileSpriteById: (id: string) => ReadyImageRecord;
  getRuntimeIsoTopCanvas: (
    srcImg: HTMLImageElement,
    rotationQuarterTurns: 0 | 1 | 2 | 3,
  ) => HTMLCanvasElement | null;
  OCEAN_TOP_SCALE: number;
  STAIR_TOP_SCALE: number;
  FLOOR_TOP_SCALE: number;
  OCEAN_BASE_FRAME_PX: number;
  getRuntimeIsoDecalCanvas: (
    srcImg: CanvasImageSource & { width?: number; height?: number },
    rotationQuarterTurns: 0 | 1 | 2 | 3,
    scale: number,
  ) => HTMLCanvasElement | null;
  getDiamondFitCanvas: (src: HTMLCanvasElement) => HTMLCanvasElement;
  getRuntimeDecalSprite: (setId: RuntimeDecalSetId, variantIndex: number) => ReadyImageRecord;
  getStaticAtlasProjectedDecalFrame?: (input: StaticAtlasProjectedDecalLookup) => StaticAtlasFrame | null;
  T: number;
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  camX: number;
  camY: number;
  ELEV_PX: number;
  STAIR_TOP_DY: number;
  SIDEWALK_ISO_HEIGHT: number;
  rampRoadTiles: ReadonlySet<string>;
  roadMarkingDecalScale: (setId: RuntimeDecalSetId, variantIndex: number) => number;
  shouldPixelSnapRoadMarking: (setId: RuntimeDecalSetId, variantIndex: number) => boolean;
  snapPx: (value: number) => number;
  getRampQuadPoints: (tx: number, ty: number, renderAnchorY: number) => RenderQuadPoints;
};

export type GroundCommandResolutionOptions = {
  staticOnly?: boolean;
  onPendingVisualChange?: () => void;
};

function notePending(record: ReadyImageRecord, onPendingVisualChange?: () => void): void {
  if (record && record.ready === false) onPendingVisualChange?.();
}

function stableSurfaceId(tx: number, ty: number, zBase: number, runtimeTop: boolean): number {
  const base = tx * 73856093 ^ ty * 19349663 ^ (zBase * 100 | 0) * 83492791;
  return runtimeTop ? base + 17 : base;
}

function stableDecalId(tx: number, ty: number, zBase: number): number {
  return (tx * 73856093 ^ ty * 19349663 ^ (zBase * 100 | 0) * 83492791) + 19;
}

export function shouldRenderGroundSurfaceForFrame(
  surface: Surface,
  renderAllHeights: boolean,
  activeH: number,
  shouldCullBuildingAt: (tx: number, ty: number, w?: number, h?: number) => boolean,
): boolean {
  const tdef = surface.tile;
  const isStairTop = surface.renderTopKind === "STAIR";
  if (tdef.kind === "VOID") return false;
  if (!renderAllHeights) {
    if (!isStairTop) {
      if (surface.zLogical !== activeH) return false;
    } else {
      const hs = tdef.h ?? 0;
      if (Math.abs(hs - activeH) > 1) return false;
    }
  }
  if (surface.id.startsWith("building_floor_") && shouldCullBuildingAt(surface.tx, surface.ty)) return false;
  return true;
}

export function shouldRenderGroundDecalForFrame(
  decal: DecalPiece,
  renderAllHeights: boolean,
  activeH: number,
): boolean {
  return renderAllHeights || decal.zLogical === activeH;
}

export function isGroundSurfaceChunkAuthorityEligible(surface: Surface, tileIdOcean: string): boolean {
  if (surface.runtimeTop?.kind === "SQUARE_128_RUNTIME") return true;
  return surface.tile.kind !== tileIdOcean;
}

export function isGroundDecalChunkAuthorityEligible(_decal: DecalPiece): boolean {
  return true;
}

export function resolveGroundSurfaceProjectedCommand(
  surface: Surface,
  deps: GroundCommandResolverDeps,
  options: GroundCommandResolutionOptions = {},
): ResolvedGroundSurfaceProjectedCommand | null {
  const { staticOnly = false, onPendingVisualChange } = options;
  const {
    w,
    ANCHOR_Y,
    TILE_ID_OCEAN,
    getAnimatedTileFrame,
    OCEAN_ANIM_TIME_SCALE,
    getTileSpriteById,
    getRuntimeIsoTopCanvas,
    OCEAN_TOP_SCALE,
    STAIR_TOP_SCALE,
    FLOOR_TOP_SCALE,
    OCEAN_BASE_FRAME_PX,
    getRuntimeIsoDecalCanvas,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    STAIR_TOP_DY,
    SIDEWALK_ISO_HEIGHT,
    rampRoadTiles,
    snapPx,
    getRampQuadPoints,
  } = deps;

  const tx = surface.tx;
  const ty = surface.ty;
  const tdef = surface.tile;
  const isStairTop = surface.renderTopKind === "STAIR";
  const placementAnchorY = LOGICAL_GROUND_SURFACE_ANCHOR_Y;

  if (staticOnly && !isGroundSurfaceChunkAuthorityEligible(surface, TILE_ID_OCEAN)) return null;

  if (surface.runtimeTop?.kind === "SQUARE_128_RUNTIME") {
    const runtimeTop = surface.runtimeTop;
    const src = getTileSpriteById(`tiles/floor/${runtimeTop.family}/${runtimeTop.variantIndex}`);
    if (!src?.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) {
      notePending(src, onPendingVisualChange);
      return null;
    }
    const baseBaked = getRuntimeIsoTopCanvas(src.img, runtimeTop.rotationQuarterTurns);
    if (!baseBaked) return null;

    const isRampRoadTile = runtimeTop.family === "asphalt" && rampRoadTiles.has(`${tx},${ty}`);
    const stableId = stableSurfaceId(tx, ty, surface.zBase, true);
    const key: RenderKey = {
      slice: tx + ty,
      within: tx,
      baseZ: surface.zBase,
      kindOrder: KindOrder.FLOOR,
      stableId,
    };
    const destinationQuad = isRampRoadTile
      ? getRampQuadPoints(tx, ty, placementAnchorY)
      : buildFlatTileDestinationQuad({
        tx,
        ty,
        zBase: surface.zBase,
        renderAnchorY: placementAnchorY,
        tileWorld: T,
        elevPx: ELEV_PX,
        isoHeight: SIDEWALK_ISO_HEIGHT,
        camX,
        camY,
        worldToScreen,
        snapPoint: snapPx,
      });
    return {
      key,
      stableId,
      tx,
      ty,
      semanticFamily: "groundSurface",
      finalForm: "quad",
      payload: buildProjectedSurfacePayload({
        image: baseBaked,
        destinationQuad,
      }),
      destinationQuad,
    };
  }

  const topRec = tdef.kind === TILE_ID_OCEAN
    ? getAnimatedTileFrame("water1", (w.timeSec ?? w.time ?? 0) * OCEAN_ANIM_TIME_SCALE)
    : (surface.spriteIdTop ? getTileSpriteById(surface.spriteIdTop) : null);
  if (!topRec?.ready || !topRec.img || topRec.img.width <= 0 || topRec.img.height <= 0) {
    notePending(topRec, onPendingVisualChange);
    return null;
  }

  const topScale = tdef.kind === TILE_ID_OCEAN
    ? OCEAN_TOP_SCALE
    : (isStairTop ? STAIR_TOP_SCALE : FLOOR_TOP_SCALE);
  const oceanProjectionScale = tdef.kind === TILE_ID_OCEAN
    ? topScale * (OCEAN_BASE_FRAME_PX / Math.max(1, Math.max(topRec.img.width, topRec.img.height)))
    : 1;
  const projectedOceanTop = tdef.kind === TILE_ID_OCEAN
    ? getRuntimeIsoDecalCanvas(topRec.img, 0, oceanProjectionScale)
    : null;
  const projectedAuthoredFloorTop = tdef.kind !== TILE_ID_OCEAN && !isStairTop
    ? getRuntimeIsoTopCanvas(topRec.img, 0)
    : null;
  const projectedTopImage = tdef.kind === TILE_ID_OCEAN
    ? projectedOceanTop
    : (projectedAuthoredFloorTop ?? topRec.img);
  if (!projectedTopImage) return null;

  const stableId = stableSurfaceId(tx, ty, surface.zBase, false);
  const key: RenderKey = {
    slice: tx + ty,
    within: tx,
    baseZ: surface.zBase,
    kindOrder: KindOrder.FLOOR,
    stableId,
  };
  const destinationQuad = buildFlatTileDestinationQuad({
    tx,
    ty,
    zBase: surface.zBase,
    renderAnchorY: placementAnchorY,
    tileWorld: T,
    elevPx: ELEV_PX,
    isoHeight: SIDEWALK_ISO_HEIGHT,
    camX,
    camY,
    worldToScreen,
    snapPoint: snapPx,
    extraDy: isStairTop ? STAIR_TOP_DY : 0,
  });
  return {
    key,
    stableId,
    tx,
    ty,
    semanticFamily: "groundSurface",
    finalForm: "quad",
    payload: buildProjectedSurfacePayload({
      image: projectedTopImage,
      destinationQuad,
    }),
    destinationQuad,
  };
}

export function resolveGroundDecalProjectedCommand(
  decal: DecalPiece,
  deps: GroundCommandResolverDeps,
  options: GroundCommandResolutionOptions = {},
): ResolvedGroundDecalProjectedCommand | null {
  const { staticOnly = false, onPendingVisualChange } = options;
  const {
    getRuntimeDecalSprite,
    getStaticAtlasProjectedDecalFrame,
    getRuntimeIsoDecalCanvas,
    getDiamondFitCanvas,
    roadMarkingDecalScale,
    shouldPixelSnapRoadMarking,
    rampRoadTiles,
    getRampQuadPoints,
    T,
    worldToScreen,
    camX,
    camY,
    ELEV_PX,
    SIDEWALK_ISO_HEIGHT,
    snapPx,
  } = deps;

  if (staticOnly && !isGroundDecalChunkAuthorityEligible(decal)) return null;

  const decalScale = roadMarkingDecalScale(decal.setId, decal.variantIndex);
  const atlasFrame = getStaticAtlasProjectedDecalFrame?.({
    setId: decal.setId,
    variantIndex: decal.variantIndex,
    rotationQuarterTurns: decal.rotationQuarterTurns,
    scale: decalScale,
  }) ?? null;
  let projectedImage = atlasFrame?.image ?? null;
  let projectedWidth = atlasFrame?.sw ?? 0;
  let projectedHeight = atlasFrame?.sh ?? 0;
  if (!atlasFrame) {
    const src = getRuntimeDecalSprite(decal.setId, decal.variantIndex);
    if (!src?.ready || !src.img || src.img.width <= 0 || src.img.height <= 0) {
      notePending(src, onPendingVisualChange);
      return null;
    }
    const baked = getRuntimeIsoDecalCanvas(src.img, decal.rotationQuarterTurns, decalScale);
    if (!baked) return null;
    const finalDiamond = getDiamondFitCanvas(baked);
    projectedImage = finalDiamond;
    projectedWidth = finalDiamond.width;
    projectedHeight = finalDiamond.height;
    countRenderStaticAtlasFallback();
  }
  if (!projectedImage) return null;
  const snapRoad = shouldPixelSnapRoadMarking(decal.setId, decal.variantIndex);
  // Keep decals centered on their historical tile-origin anchor without letting source height drive placement.
  const decalQuadOffsetY = -SIDEWALK_ISO_HEIGHT * 0.5;
  const destinationQuad = rampRoadTiles.has(`${decal.tx},${decal.ty}`)
    ? getRampQuadPoints(decal.tx, decal.ty, decal.renderAnchorY)
    : buildFlatTileDestinationQuad({
      tx: decal.tx,
      ty: decal.ty,
      zBase: decal.zBase,
      renderAnchorY: decal.renderAnchorY,
      tileWorld: T,
      elevPx: ELEV_PX,
      isoHeight: SIDEWALK_ISO_HEIGHT,
      camX,
      camY,
      worldToScreen,
      snapPoint: snapRoad ? Math.round : snapPx,
      extraDy: decalQuadOffsetY,
    });

  const stableId = stableDecalId(decal.tx, decal.ty, decal.zBase);
  return {
    key: {
      slice: decal.tx + decal.ty,
      within: decal.tx,
      baseZ: decal.zBase,
      kindOrder: KindOrder.DECAL,
      stableId,
    },
    stableId,
    tx: decal.tx,
    ty: decal.ty,
    semanticFamily: "groundDecal",
    finalForm: "quad",
    payload: buildGroundDecalProjectedSurfacePayload({
      image: projectedImage,
      destinationQuad,
      sourceOffsetX: atlasFrame?.sx ?? 0,
      sourceOffsetY: atlasFrame?.sy ?? 0,
      sourceWidth: projectedWidth,
      sourceHeight: projectedHeight,
    }),
    destinationQuad,
  };
}
