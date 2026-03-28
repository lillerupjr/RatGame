import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";
import type { StructureV6ShadowCacheFrameStats } from "../structureShadows/structureShadowV6Cache";
import {
  buildRuntimeStructureProjectedDraw,
  rectIntersects as runtimeStructureRectIntersects,
  runtimeStructureTriangleGeometrySignatureForOverlay,
} from "../../../structures/monolithicStructureGeometry";
import { buildStructureShadowFrameResult as buildOrchestratedStructureShadowFrameResult } from "../structureShadows/structureShadowOrchestrator";
import { shouldBuildStructureV6ShadowMasksForFrame } from "../structureShadows/structureShadowVersionRouting";
import { buildRuntimeStructureTriangleSemanticMap } from "../structureShadows/structureTriangleSemantics";
import {
  buildRectDestinationQuad,
  buildRectQuadPayload,
  buildQuadRenderPieceFromPoints,
  resolveTriangleCutoutAlpha,
} from "../renderCommandGeometry";
import { remapStructureTrianglePointToAtlas } from "../structureSpriteAtlas";
import {
  countRenderStructureEstimatedTrianglesAvoided,
  countRenderStructureMonolithicGroupSubmission,
  countRenderStructureMonolithicTriangles,
  countRenderStructureQuadApproxAccepted,
  countRenderStructureQuadApproxRejected,
  countRenderStructureRectMeshMigratedToQuad,
  countRenderStructureRectMeshSubmission,
  countRenderStructureSingleQuadSubmission,
  countRenderStructureTotalSubmission,
  countRenderStructureTrianglesSubmitted,
} from "../renderPerfCounters";

type RenderKey = any;
type RenderPoint = { x: number; y: number };
type RectBounds = { minX: number; minY: number; maxX: number; maxY: number };
type RuntimeLocalRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};
type ProcessedStructureTriangle = {
  stableId: number | undefined;
  cameraTx: number;
  cameraTy: number;
  localSrcPoints: [RenderPoint, RenderPoint, RenderPoint];
  srcPoints: [RenderPoint, RenderPoint, RenderPoint];
  dstPoints: [RenderPoint, RenderPoint, RenderPoint];
  sourceBounds: RectBounds;
  destinationBounds: RectBounds;
  heightFromParentLevel: number;
  alpha: number;
};

export function collectStructureDrawables(input: CollectionContext): {
  didQueueStructureCutoutDebugRect: boolean;
  structureV6VerticalShadowDebugData: unknown;
  structureV6VerticalShadowDebugDataList: readonly unknown[];
  structureV6ShadowCacheStats: unknown;
} {
  const {
    DISABLE_WALLS_AND_CURTAINS,
    isTileInRenderRadius,
    buildFaceDraws,
    facePieceLayers,
    facePiecesInViewForLayer,
    viewRect,
    KindOrder,
    frameBuilder,
    occluderLayers,
    occludersInViewForLayer,
    shouldCullBuildingAt,
    buildWallDraw,
    CONTAINER_WALL_SORT_BIAS,
    resolveStructureOverlayAdmissionContext,
    compiledMap,
    strictViewportTileBounds,
    structureTriangleAdmissionMode,
    collectStructureOverlays,
    debugFlags,
    tileRectIntersectsRenderRadius,
    buildOverlayDraw,
    deriveStructureSouthTieBreakFromSeAnchor,
    buildStructureSlices,
    ctx,
    T,
    projectedViewportRect,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    structureCutoutScreenRect,
    isPointInsideStructureCutoutScreenRect,
    playerCameraTx,
    playerCameraTy,
    isParentTileAfterPlayer,
    toScreenAtZ,
    rampRoadTiles,
    resolveRenderZBand,
    structureShadowFrame,
    SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
    SHADOW_V6_SECONDARY_SEMANTIC_BUCKET,
    SHADOW_V6_TOP_SEMANTIC_BUCKET,
    getStructureSpriteAtlasFrame,
    monolithicStructureGeometryCacheStore,
    getTileSpriteById,
    getFlippedOverlayImage,
    SHOW_STRUCTURE_SLICE_DEBUG,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHOW_STRUCTURE_ANCHORS,
    SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG,
    deferredStructureSliceDebugDraws,
    LOG_STRUCTURE_OWNERSHIP_DEBUG,
    loggedStructureOwnershipDebugIds,
    structureV6ShadowDebugCandidates,
    staticRelight,
    buildStructureDrawables,
    buildStructureV6VerticalShadowFrameResults,
    SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    SHADOW_V6_STRUCTURE_INDEX,
    SHADOW_V6_SLICE_COUNT,
    SHADOW_V6_ALL_STRUCTURES,
    SHADOW_V6_ONE_STRUCTURE_ONLY,
    SHADOW_V6_VERTICAL_ONLY,
    SHADOW_V6_TOP_ONLY,
    SHADOW_V6_FORCE_REFRESH,
    STRUCTURE_SHADOW_V5_LENGTH_PX,
    countStructureV6CandidateTrianglesForBucket,
    resolveStructureV6SelectedCandidateIndex,
    buildStructureV6VerticalShadowMaskDebugData,
    structureShadowV6CacheStore,
  } = input as any;

  let didQueueStructureCutoutDebugRect = input.didQueueStructureCutoutDebugRect ?? false;
  let structureV6VerticalShadowDebugData: unknown = input.structureV6VerticalShadowDebugData ?? null;
  let structureV6VerticalShadowDebugDataList: readonly unknown[] = input.structureV6VerticalShadowDebugDataList ?? [];
  let structureV6ShadowCacheStats: StructureV6ShadowCacheFrameStats = input.structureV6ShadowCacheStats as StructureV6ShadowCacheFrameStats;
  if (!structureV6ShadowCacheStats) {
    structureV6ShadowCacheStats = {
      sunStepKey: structureShadowFrame.sunModel.stepKey,
      cacheHits: 0,
      cacheMisses: 0,
      rebuiltStructures: 0,
      reusedStructures: 0,
      sunStepChanged: false,
      forceRefresh: false,
      cacheSize: 0,
    };
  }

  const buildStructureOverlayQuadPayload = (
    overlaySpriteId: string | undefined,
    draw: {
      img: CanvasImageSource;
      dx: number;
      dy: number;
      dw: number;
      dh: number;
      flipX?: boolean;
      scale?: number;
    },
  ) => {
    const atlasFrame = overlaySpriteId ? (getStructureSpriteAtlasFrame?.(overlaySpriteId) ?? null) : null;
    const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
    const localSourceWidth = Number(draw.dw ?? 0);
    const localSourceHeight = Number(draw.dh ?? 0);
    return buildRectQuadPayload({
      image: atlasFrame?.image ?? draw.img,
      sourceRectWidth: localSourceWidth,
      sourceRectHeight: localSourceHeight,
      sourceOffsetX: atlasFrame?.sx ?? 0,
      sourceOffsetY: atlasFrame?.sy ?? 0,
      dx: Number(draw.dx ?? 0),
      dy: Number(draw.dy ?? 0),
      dw: Number(draw.dw ?? 0) * scale,
      dh: Number(draw.dh ?? 0) * scale,
      flipX: !!draw.flipX,
      auditFamily: "structures",
    });
  };

  const boundsFromPoints = (points: readonly RenderPoint[]): RectBounds | null => {
    if (points.length <= 0) return null;
    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    return { minX, minY, maxX, maxY };
  };

  const boundsFromRuntimeRect = (rect: RuntimeLocalRect | null | undefined): RectBounds | null => {
    if (!rect) return null;
    const minX = Number(rect.x ?? 0);
    const minY = Number(rect.y ?? 0);
    const width = Number(rect.w ?? 0);
    const height = Number(rect.h ?? 0);
    if (
      !Number.isFinite(minX)
      || !Number.isFinite(minY)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
    ) {
      return null;
    }
    return {
      minX,
      minY,
      maxX: minX + Math.max(0, width),
      maxY: minY + Math.max(0, height),
    };
  };

  const rectArea = (bounds: RectBounds | null): number => {
    if (!bounds) return 0;
    return Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
  };

  const unionBounds = (a: RectBounds | null, b: RectBounds | null): RectBounds | null => {
    if (!a) return b;
    if (!b) return a;
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    };
  };

  const processStructureTriangles = (
    piece: any,
    atlasFrame: { image: HTMLCanvasElement | OffscreenCanvas; sx: number; sy: number; sw: number; sh: number } | null,
    sourceWidth: number,
  ): ProcessedStructureTriangle[] => (
    piece.finalVisibleTriangles.map((triangle: any) => {
      const localSrcPoints = triangle.srcPoints.map((point: any) => ({
        x: Number(point.x ?? 0),
        y: Number(point.y ?? 0),
      })) as [RenderPoint, RenderPoint, RenderPoint];
      const flippedSrcPoints = localSrcPoints.map((point) => ({
        x: !!piece.draw.flipX ? sourceWidth - point.x : point.x,
        y: point.y,
      })) as [RenderPoint, RenderPoint, RenderPoint];
      const remappedSrcPoints = atlasFrame
        ? flippedSrcPoints.map((point) => remapStructureTrianglePointToAtlas(point, atlasFrame))
        : flippedSrcPoints;
      const dstPoints = triangle.points.map((point: any) => ({
        x: Number(point.x ?? 0),
        y: Number(point.y ?? 0),
      })) as [RenderPoint, RenderPoint, RenderPoint];
      const localSourceBounds = boundsFromRuntimeRect(triangle.srcRectLocal)
        ?? (boundsFromPoints(localSrcPoints) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 });
      const flippedSourceBounds = !!piece.draw.flipX
        ? {
          minX: sourceWidth - localSourceBounds.maxX,
          minY: localSourceBounds.minY,
          maxX: sourceWidth - localSourceBounds.minX,
          maxY: localSourceBounds.maxY,
        }
        : localSourceBounds;
      const atlasSourceBounds = atlasFrame
        ? {
          minX: atlasFrame.sx + flippedSourceBounds.minX,
          minY: atlasFrame.sy + flippedSourceBounds.minY,
          maxX: atlasFrame.sx + flippedSourceBounds.maxX,
          maxY: atlasFrame.sy + flippedSourceBounds.maxY,
        }
        : flippedSourceBounds;
      const destinationBounds = boundsFromRuntimeRect(triangle.dstRectLocal)
        ?? (boundsFromPoints(dstPoints) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 });
      return {
        stableId: triangle.stableId,
        cameraTx: Number(triangle.cameraTx ?? 0),
        cameraTy: Number(triangle.cameraTy ?? 0),
        localSrcPoints,
        srcPoints: [remappedSrcPoints[0], remappedSrcPoints[1], remappedSrcPoints[2]],
        dstPoints: [dstPoints[0], dstPoints[1], dstPoints[2]],
        sourceBounds: atlasSourceBounds,
        destinationBounds,
        heightFromParentLevel: Math.max(0, Number(triangle.heightFromParentLevel ?? 0)),
        alpha: resolveTriangleCutoutAlpha(
          [dstPoints[0], dstPoints[1], dstPoints[2]],
          {
            cutoutEnabled: piece.cutoutEnabled,
            cutoutAlpha: piece.cutoutAlpha,
            buildingDirectionalEligible: piece.buildingDirectionalEligible,
            groupParentAfterPlayer: piece.groupParentAfterPlayer,
            cutoutScreenRect: structureCutoutScreenRect,
          },
        ),
      };
    })
  );

  const tryBuildMonolithicCellQuadPayloads = (
    piece: any,
    atlasFrame: { image: HTMLCanvasElement | OffscreenCanvas; sx: number; sy: number; sw: number; sh: number } | null,
    processedTriangles: readonly ProcessedStructureTriangle[],
  ) => {
    const image = atlasFrame?.image ?? piece.draw.img;
    if (!image) return { accepted: [], rejected: 0 };
    const byCell = new Map<string, {
      cameraTx: number;
      cameraTy: number;
      sourceBounds: RectBounds | null;
      destinationBounds: RectBounds | null;
      triangleCount: number;
      alpha: number;
      maxHeightFromParentLevel: number;
    }>();

    for (let i = 0; i < processedTriangles.length; i++) {
      const triangle = processedTriangles[i];
      const cellKey = `${triangle.cameraTx},${triangle.cameraTy}`;
      const existing = byCell.get(cellKey);
      if (existing) {
        existing.sourceBounds = unionBounds(existing.sourceBounds, triangle.sourceBounds);
        existing.destinationBounds = unionBounds(existing.destinationBounds, triangle.destinationBounds);
        existing.triangleCount += 1;
        existing.alpha = Math.min(existing.alpha, triangle.alpha);
        existing.maxHeightFromParentLevel = Math.max(existing.maxHeightFromParentLevel, triangle.heightFromParentLevel);
        continue;
      }
      byCell.set(cellKey, {
        cameraTx: triangle.cameraTx,
        cameraTy: triangle.cameraTy,
        sourceBounds: triangle.sourceBounds,
        destinationBounds: triangle.destinationBounds,
        triangleCount: 1,
        alpha: triangle.alpha,
        maxHeightFromParentLevel: triangle.heightFromParentLevel,
      });
    }

    const accepted: Array<{ payload: ReturnType<typeof buildQuadRenderPieceFromPoints>; triangleCount: number }> = [];
    let rejected = 0;
    for (const cell of byCell.values()) {
      const sourceBounds = cell.sourceBounds;
      const destinationBounds = cell.destinationBounds;
      if (
        !sourceBounds
        || !destinationBounds
        || !Number.isFinite(sourceBounds.minX)
        || !Number.isFinite(sourceBounds.minY)
        || !Number.isFinite(sourceBounds.maxX)
        || !Number.isFinite(sourceBounds.maxY)
        || !Number.isFinite(destinationBounds.minX)
        || !Number.isFinite(destinationBounds.minY)
        || !Number.isFinite(destinationBounds.maxX)
        || !Number.isFinite(destinationBounds.maxY)
        || !(sourceBounds.maxX > sourceBounds.minX)
        || !(sourceBounds.maxY > sourceBounds.minY)
        || !(destinationBounds.maxX > destinationBounds.minX)
        || !(destinationBounds.maxY > destinationBounds.minY)
      ) {
        rejected += 1;
        continue;
      }

      const zVisual = Number(piece.overlay.z ?? 0)
        + Number(piece.overlay.zVisualOffsetUnits ?? 0)
        + cell.maxHeightFromParentLevel;
      const destinationQuad = buildRectDestinationQuad(
        destinationBounds.minX,
        destinationBounds.minY,
        destinationBounds.maxX - destinationBounds.minX,
        destinationBounds.maxY - destinationBounds.minY,
      );
      accepted.push({
        payload: buildQuadRenderPieceFromPoints({
          auditFamily: "structures",
          image,
          sx: sourceBounds.minX,
          sy: sourceBounds.minY,
          sw: sourceBounds.maxX - sourceBounds.minX,
          sh: sourceBounds.maxY - sourceBounds.minY,
          destinationQuad,
          kind: "rect",
          alpha: cell.alpha,
        }),
        triangleCount: cell.triangleCount,
      });
    }

    return { accepted, rejected };
  };

  // Collect non-wall FACE pieces into slices
  // ----------------------------
  {
    const allFaces: any[] = [];
    const layers = facePieceLayers();
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const list = facePiecesInViewForLayer(layer, viewRect);
      if (list.length > 0) allFaces.push(...list);
    }

    for (let fi = 0; fi < allFaces.length; fi++) {
      const face = allFaces[fi];
      if (
        DISABLE_WALLS_AND_CURTAINS
        && (face.kind === "WALL" || face.kind === "FLOOR_APRON" || face.kind === "STAIR_APRON")
      ) continue;
      if (!isTileInRenderRadius(face.tx, face.ty)) continue;
      const faceStableId = face.tx * 73856093 ^ face.ty * 19349663 ^ (face.zFrom * 100 | 0) * 83492791;
      const draws = buildFaceDraws(face);
      for (let di = 0; di < draws.length; di++) {
        const d = draws[di];
        const faceKindOrder = face.layerRole === "STRUCTURE" ? KindOrder.STRUCTURE : KindOrder.FLOOR;
        const renderKey: RenderKey = {
          slice: face.tx + face.ty,
          within: face.tx,
          baseZ: face.zFrom ?? face.zTo ?? 0,
          kindOrder: faceKindOrder,
          stableId: faceStableId + di * 0.001,
        };
        countRenderStructureTotalSubmission();
        countRenderStructureRectMeshSubmission();
        countRenderStructureRectMeshMigratedToQuad();
        countRenderStructureSingleQuadSubmission();
        countRenderStructureEstimatedTrianglesAvoided(2);
        enqueueSliceCommand(frameBuilder, renderKey, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: buildRectQuadPayload({
            image: d.img,
            dx: Number(d.dx ?? 0),
            dy: Number(d.dy ?? 0),
            dw: Number(d.dw ?? 0) * (Number.isFinite(Number(d.scale)) ? Number(d.scale) : 1),
            dh: Number(d.dh ?? 0) * (Number.isFinite(Number(d.scale)) ? Number(d.scale) : 1),
            sourceRectWidth: Number(d.dw ?? 0),
            sourceRectHeight: Number(d.dh ?? 0),
            flipX: !!d.flipX,
            auditFamily: "structures",
          }),
        });
      }
    }
  }

  // ----------------------------
  // Collect OCCLUDERS (walls only) into slices
  // ----------------------------
  {
    const allOccluders: any[] = [];
    const layers = occluderLayers();
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const list = occludersInViewForLayer(layer, viewRect);
      if (list.length > 0) allOccluders.push(...list);
    }
    let occluderId = 0;

    for (let oi = 0; oi < allOccluders.length; oi++) {
      const occ = allOccluders[oi];
      if (DISABLE_WALLS_AND_CURTAINS) continue;
      if (!isTileInRenderRadius(occ.tx, occ.ty)) continue;
      if (occ.kind !== "WALL") continue;
      const occStableId = occ.tx * 73856093 ^ occ.ty * 19349663 ^ (occ.zFrom * 100 | 0) * 83492791;
      if (occ.id.startsWith("stamp_wall_") && shouldCullBuildingAt(occ.tx, occ.ty)) continue;
      const draw = buildWallDraw(occ, occluderId++);
      if (!draw) continue;
      const isContainerWall = occ.spriteId?.includes("structures/containers/");
      const wallKindOrder = occ.layerRole === "STRUCTURE" ? KindOrder.STRUCTURE : KindOrder.OCCLUDER;
      const renderKey: RenderKey = {
        slice: occ.tx + occ.ty,
        within: occ.tx,
        baseZ: occ.zFrom + (isContainerWall ? CONTAINER_WALL_SORT_BIAS : 0),
        kindOrder: wallKindOrder,
        stableId: occStableId,
      };
      countRenderStructureTotalSubmission();
      countRenderStructureRectMeshSubmission();
      countRenderStructureRectMeshMigratedToQuad();
      countRenderStructureSingleQuadSubmission();
      countRenderStructureEstimatedTrianglesAvoided(2);
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldSprite",
        finalForm: "quad",
        payload: buildRectQuadPayload({
          image: draw.img,
          dx: Number(draw.dx ?? 0),
          dy: Number(draw.dy ?? 0),
          dw: Number(draw.dw ?? 0) * (Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1),
          dh: Number(draw.dh ?? 0) * (Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1),
          sourceRectWidth: Number(draw.dw ?? 0),
          sourceRectHeight: Number(draw.dh ?? 0),
          flipX: !!draw.flipX,
          auditFamily: "structures",
        }),
      });
    }
  }
  // ----------------------------
  // Collect OVERLAYS (roofs + props) into slices
  // ----------------------------
  {
    const structureAdmission = resolveStructureOverlayAdmissionContext({
      compiledMap,
      strictViewportTileBounds,
      viewRect,
      structureTriangleAdmissionMode,
    });

    const structureOverlayCandidates = collectStructureOverlays({
      showMapOverlays: debugFlags.showMapOverlays,
      admission: structureAdmission,
      tileRectIntersectsRenderRadius,
      shouldCullBuildingAt,
      buildOverlayDraw,
      deriveStructureSouthTieBreakFromSeAnchor,
    });

    const structureSliceBuild = buildStructureSlices({
      ctx,
      candidates: structureOverlayCandidates,
      tileWorld: T,
      projectedViewportRect,
      strictViewportTileBounds,
      structureTriangleAdmissionMode,
      structureTriangleCutoutEnabled,
      structureTriangleCutoutHalfWidth,
      structureTriangleCutoutHalfHeight,
      structureTriangleCutoutAlpha,
      structureCutoutScreenRect,
      isPointInsideStructureCutoutScreenRect,
      playerCameraTx,
      playerCameraTy,
      isTileInRenderRadius,
      isParentTileAfterPlayer,
      toScreenAtZ,
      rampRoadTiles,
      resolveRenderZBand,
      structureShadowFrame,
      v6PrimarySemanticBucket: SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
      v6SecondarySemanticBucket: SHADOW_V6_SECONDARY_SEMANTIC_BUCKET,
      v6TopSemanticBucket: SHADOW_V6_TOP_SEMANTIC_BUCKET,
      monolithicStructureGeometryCacheStore,
      getFlippedOverlayImage,
      showStructureSliceDebug: SHOW_STRUCTURE_SLICE_DEBUG,
      showStructureTriangleFootprintDebug: SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
      showStructureAnchors: SHOW_STRUCTURE_ANCHORS,
      showStructureTriangleOwnershipSortDebug: SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG,
      deferredStructureSliceDebugDraws,
      didQueueStructureCutoutDebugRect,
      logStructureOwnershipDebug: LOG_STRUCTURE_OWNERSHIP_DEBUG,
      loggedStructureOwnershipDebugIds,
      shadowQueueCallbacks: {
        structureV6ShadowDebugCandidates,
      },
      staticRelightFrame: staticRelight.frame,
    });

    didQueueStructureCutoutDebugRect = structureSliceBuild.didQueueStructureCutoutDebugRect;

    const structureDrawables = buildStructureDrawables(structureSliceBuild.pieces);
    for (let si = 0; si < structureDrawables.length; si++) {
      const structureDrawable = structureDrawables[si];
      if (structureDrawable.payload.kind === "overlay") {
        const overlay = structureDrawable.payload.piece.overlay;
        const draw = structureDrawable.payload.piece.draw;
        if ((overlay.kind ?? "ROOF") === "PROP") {
          enqueueSliceCommand(frameBuilder, structureDrawable.key, {
            semanticFamily: "worldSprite",
            finalForm: "quad",
            payload: {
              draw,
            },
          });
          continue;
        }

        countRenderStructureTotalSubmission();
        countRenderStructureRectMeshSubmission();
        countRenderStructureRectMeshMigratedToQuad();
        countRenderStructureSingleQuadSubmission();
        countRenderStructureEstimatedTrianglesAvoided(2);
        enqueueSliceCommand(frameBuilder, structureDrawable.key, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: buildStructureOverlayQuadPayload(overlay.spriteId, draw),
        });
        continue;
      }

      const piece = structureDrawable.payload.piece;
      const atlasFrame = piece.overlay.spriteId ? (getStructureSpriteAtlasFrame?.(piece.overlay.spriteId) ?? null) : null;
      const sourceWidth = Number(piece.draw.dw ?? 0);
      const compareDistanceOnlyStableIds = new Set<number>(
        piece.compareDistanceOnlyTriangles.map((triangle: any) => triangle.stableId),
      );
      const processedTriangles = processStructureTriangles(piece, atlasFrame, sourceWidth);
      countRenderStructureMonolithicGroupSubmission();
      countRenderStructureMonolithicTriangles(processedTriangles.length);

      const extractedCells = tryBuildMonolithicCellQuadPayloads(piece, atlasFrame, processedTriangles);
      for (let ci = 0; ci < extractedCells.accepted.length; ci++) {
        const cell = extractedCells.accepted[ci];
        countRenderStructureTotalSubmission();
        countRenderStructureSingleQuadSubmission();
        countRenderStructureQuadApproxAccepted();
        countRenderStructureEstimatedTrianglesAvoided(cell.triangleCount);
        enqueueSliceCommand(frameBuilder, structureDrawable.key, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: cell.payload,
        });
      }
      if (extractedCells.rejected > 0) {
        countRenderStructureQuadApproxRejected(extractedCells.rejected);
      }

      if (compareDistanceOnlyStableIds.size > 0) {
        const normalizedTriangles = processedTriangles.map((triangle) => ({
          stableId: triangle.stableId,
          dstPoints: triangle.dstPoints,
        }));
        enqueueSliceCommand(frameBuilder, {
          ...structureDrawable.key,
          stableId: Number(structureDrawable.key.stableId) + 0.0005,
        }, {
          semanticFamily: "debug",
          finalForm: "primitive",
          payload: {
            triangleOverlay: normalizedTriangles
              .filter((triangle: any) => compareDistanceOnlyStableIds.has(triangle.stableId))
              .map((triangle: any) => ({
                points: triangle.dstPoints,
                fillStyle: "rgba(255,120,40,0.28)",
                strokeStyle: "rgba(255,120,40,0.9)",
                lineWidth: 1,
              })),
          },
        });
      }
    }
  }

  const includeVerticalShadowBuckets = !SHADOW_V6_TOP_ONLY || SHADOW_V6_VERTICAL_ONLY;
  const includeTopShadowBucket = !SHADOW_V6_VERTICAL_ONLY || SHADOW_V6_TOP_ONLY;
  const forceRefresh = !!SHADOW_V6_FORCE_REFRESH;
  const cacheFrameReset = structureShadowV6CacheStore.beginFrame(
    compiledMap.id,
    structureShadowFrame.sunModel.stepKey,
    forceRefresh,
  );
  structureV6ShadowCacheStats = {
    sunStepKey: structureShadowFrame.sunModel.stepKey,
    cacheHits: 0,
    cacheMisses: 0,
    rebuiltStructures: 0,
    reusedStructures: 0,
    sunStepChanged: cacheFrameReset.sunStepChanged,
    forceRefresh,
    cacheSize: 0,
  };
  if (shouldBuildStructureV6ShadowMasksForFrame(structureShadowFrame)) {
    const fullMapPopulationKey = [
      `map:${compiledMap.id}`,
      `sun:${structureShadowFrame.sunModel.stepKey}`,
      `slice:${SHADOW_V6_SLICE_COUNT}`,
      `vertical:${includeVerticalShadowBuckets ? 1 : 0}`,
      `top:${includeTopShadowBucket ? 1 : 0}`,
    ].join("||");
    if (!structureShadowV6CacheStore.isFullyPopulatedForKey(fullMapPopulationKey)) {
      const noopHybridDiagnostics = {
        cacheHits: 0,
        cacheMisses: 0,
        casterTriangles: 0,
        projectedTriangles: 0,
      };
      const noopV4Diagnostics = {
        cacheHits: 0,
        cacheMisses: 0,
        correspondences: 0,
        strips: 0,
        layerEdges: 0,
        layerBands: 0,
        sourceBandTriangles: 0,
        destinationBandEntries: 0,
        correspondencePairs: 0,
        correspondenceMismatches: 0,
        topCapTriangles: 0,
        destinationBandPairs: 0,
        destinationTriangles: 0,
        diagonalA: 0,
        diagonalB: 0,
        diagonalRule: "",
        deltaConstPass: 0,
        deltaConstFail: 0,
        firstSliceSummary: "",
        sampleRoofHeightPx: null,
        sampleLayerHeights: "",
        sampleSliceCount: 0,
        sampleLayerEdges: 0,
        sampleLayerBands: 0,
        sampleSelectedSlice: "",
        sampleSelectedBand: "",
      };
      const mapOverlays = Array.isArray(compiledMap.overlays) ? compiledMap.overlays : [];
      for (let i = 0; i < mapOverlays.length; i++) {
        const overlay = mapOverlays[i];
        if (overlay.layerRole !== "STRUCTURE" || !overlay.spriteId) continue;
        const spriteRec = getTileSpriteById(overlay.spriteId);
        if (!spriteRec?.ready || !spriteRec.img || spriteRec.img.width <= 0 || spriteRec.img.height <= 0) continue;
        const projectedDraw = buildRuntimeStructureProjectedDraw(overlay, spriteRec.img);
        const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(overlay, projectedDraw);
        const triangleCache = monolithicStructureGeometryCacheStore.get(overlay.id, geometrySignature);
        if (!triangleCache || triangleCache.triangles.length <= 0) continue;
        const cached = !forceRefresh
          ? structureShadowV6CacheStore.get({
            structureInstanceId: overlay.id,
            expectedGeometrySignature: geometrySignature,
            expectedSunStepKey: structureShadowFrame.sunModel.stepKey,
            expectedSliceCount: SHADOW_V6_SLICE_COUNT,
            expectedIncludeVertical: includeVerticalShadowBuckets,
            expectedIncludeTop: includeTopShadowBucket,
          })
          : undefined;
        if (cached) {
          structureV6ShadowCacheStats.cacheHits += 1;
          structureV6ShadowCacheStats.reusedStructures += 1;
          continue;
        }
        const sourceImage: CanvasImageSource = projectedDraw.flipX
          ? getFlippedOverlayImage(spriteRec.img)
          : spriteRec.img;
        const semanticByStableId = buildRuntimeStructureTriangleSemanticMap({
          overlay,
          triangleCache,
          tileWorld: T,
          toScreenAtZ,
        });
        const structureShadowBand = resolveRenderZBand(
          {
            slice: overlay.seTx + overlay.seTy,
            within: overlay.seTx,
            baseZ: overlay.z,
          },
          rampRoadTiles,
        );
        const shadowResult = buildOrchestratedStructureShadowFrameResult({
          frame: structureShadowFrame,
          structureInstanceId: overlay.id,
          geometrySignature,
          draw: {
            dw: projectedDraw.dw,
            dh: projectedDraw.dh,
          },
          sourceImage,
          admittedTrianglesForSemanticMasks: triangleCache.triangles,
          semanticByStableId,
          structureShadowBand,
          v6PrimarySemanticBucket: SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
          v6SecondarySemanticBucket: SHADOW_V6_SECONDARY_SEMANTIC_BUCKET,
          v6TopSemanticBucket: SHADOW_V6_TOP_SEMANTIC_BUCKET,
        });
        const candidate = shadowResult.v6Candidate;
        if (!candidate) continue;
        structureV6ShadowCacheStats.cacheMisses += 1;
        const rebuilt = buildStructureV6VerticalShadowMaskDebugData(
          candidate,
          SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
          0,
          0,
          1,
          SHADOW_V6_SLICE_COUNT,
          {
            x: structureShadowFrame.sunModel.projectionDirection.x * STRUCTURE_SHADOW_V5_LENGTH_PX,
            y: structureShadowFrame.sunModel.projectionDirection.y * STRUCTURE_SHADOW_V5_LENGTH_PX,
          },
          {
            includeVertical: includeVerticalShadowBuckets,
            includeTop: includeTopShadowBucket,
          },
        );
        if (!rebuilt) continue;
        structureShadowV6CacheStore.set({
          structureInstanceId: overlay.id,
          geometrySignature,
          sunStepKey: structureShadowFrame.sunModel.stepKey,
          requestedSliceCount: SHADOW_V6_SLICE_COUNT,
          includeVertical: includeVerticalShadowBuckets,
          includeTop: includeTopShadowBucket,
          mergedShadowMask: rebuilt,
        });
        structureV6ShadowCacheStats.rebuiltStructures += 1;
      }
      structureShadowV6CacheStore.markFullyPopulatedForKey(fullMapPopulationKey);
    }
  }
  const v6VerticalFrameResults = buildStructureV6VerticalShadowFrameResults({
    frame: structureShadowFrame,
    candidates: structureV6ShadowDebugCandidates,
    primarySemanticBucket: SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
    requestedSemanticBucket: SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    requestedStructureIndex: SHADOW_V6_STRUCTURE_INDEX,
    requestedSliceCount: SHADOW_V6_SLICE_COUNT,
    shadowLengthPx: STRUCTURE_SHADOW_V5_LENGTH_PX,
    countCandidateTrianglesForBucket: countStructureV6CandidateTrianglesForBucket,
    resolveSelectedCandidateIndex: resolveStructureV6SelectedCandidateIndex,
    buildVerticalDebugData: (
      candidate: any,
      requestedSemanticBucket: any,
      requestedStructureIndex: any,
      selectedStructureIndex: any,
      candidateCount: any,
      requestedSliceCount: any,
      shadowVector: any,
    ) => {
      if (!forceRefresh) {
        const cached = structureShadowV6CacheStore.get({
          structureInstanceId: candidate.structureInstanceId,
          expectedGeometrySignature: candidate.geometrySignature,
          expectedSunStepKey: structureShadowFrame.sunModel.stepKey,
          expectedSliceCount: requestedSliceCount,
          expectedIncludeVertical: includeVerticalShadowBuckets,
          expectedIncludeTop: includeTopShadowBucket,
        });
        if (cached) {
          structureV6ShadowCacheStats.cacheHits += 1;
          structureV6ShadowCacheStats.reusedStructures += 1;
          return cached.mergedShadowMask;
        }
      }
      structureV6ShadowCacheStats.cacheMisses += 1;
      const rebuilt = buildStructureV6VerticalShadowMaskDebugData(
        candidate,
        requestedSemanticBucket,
        requestedStructureIndex,
        selectedStructureIndex,
        candidateCount,
        requestedSliceCount,
        shadowVector,
        {
          includeVertical: includeVerticalShadowBuckets,
          includeTop: includeTopShadowBucket,
        },
      );
      if (rebuilt) {
        structureShadowV6CacheStore.set({
          structureInstanceId: candidate.structureInstanceId,
          geometrySignature: candidate.geometrySignature,
          sunStepKey: structureShadowFrame.sunModel.stepKey,
          requestedSliceCount: requestedSliceCount,
          includeVertical: includeVerticalShadowBuckets,
          includeTop: includeTopShadowBucket,
          mergedShadowMask: rebuilt,
        });
        structureV6ShadowCacheStats.rebuiltStructures += 1;
      }
      return rebuilt;
    },
  });
  structureV6VerticalShadowDebugData = v6VerticalFrameResults.selected;

  const drawOneStructureOnly = !!SHADOW_V6_ONE_STRUCTURE_ONLY;
  const drawAllStructures = !drawOneStructureOnly && !!SHADOW_V6_ALL_STRUCTURES;
  if (drawOneStructureOnly) {
    structureV6VerticalShadowDebugDataList = v6VerticalFrameResults.selected ? [v6VerticalFrameResults.selected] : [];
  } else if (drawAllStructures) {
    structureV6VerticalShadowDebugDataList = v6VerticalFrameResults.all;
  } else {
    structureV6VerticalShadowDebugDataList = [];
  }
  structureV6ShadowCacheStats.cacheSize = structureShadowV6CacheStore.size();

  // ============================================

  return {
    didQueueStructureCutoutDebugRect,
    structureV6VerticalShadowDebugData,
    structureV6VerticalShadowDebugDataList,
    structureV6ShadowCacheStats,
  };
}
