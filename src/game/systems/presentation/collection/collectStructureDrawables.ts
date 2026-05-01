import type { CollectionContext } from "../contracts/collectionContext";
import { enqueueSliceCommand } from "../frame/renderFrameBuilder";
import {
  buildRuntimeStructureProjectedDraw,
  rectIntersects as runtimeStructureRectIntersects,
  runtimeStructureTriangleGeometrySignatureForOverlay,
} from "../../../structures/monolithicStructureGeometry";
import { buildRuntimeStructureTriangleSemanticMap } from "../structureShadows/structureTriangleSemantics";
import {
  buildRectDestinationQuad,
  buildRectQuadPayload,
  buildQuadRenderPieceFromPoints,
  resolveTriangleCutoutAlpha,
} from "../renderCommandGeometry";
import {
  countRenderStaticAtlasBypass,
  countRenderStaticAtlasFallback,
  countRenderStructureEstimatedTrianglesAvoided,
  countRenderStructureGroupedPostSubmission,
  countRenderStructureGroupedPreSubmission,
  countRenderStructureMergedSliceCacheHit,
  countRenderStructureMergedSliceCacheMiss,
  countRenderStructureMergedSliceCacheRebuild,
  countRenderStructureMergedSliceSubmission,
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
import { buildStructureMergedSliceCacheEntry } from "../structures/structureMergedSliceCache";

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

type DestinationQuadBuilder = (input: {
  cameraTx: number;
  cameraTy: number;
  zVisual: number;
  destinationBounds: RectBounds;
}) => {
  nw: RenderPoint;
  ne: RenderPoint;
  se: RenderPoint;
  sw: RenderPoint;
};

export function collectStructureDrawables(input: CollectionContext): {
  didQueueStructureCutoutDebugRect: boolean;
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
    ISO_X,
    ISO_Y,
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
    getStaticAtlasSpriteFrame,
    monolithicStructureGeometryCacheStore,
    structureMergedSliceCacheStore,
    getFlippedOverlayImage,
    SHOW_STRUCTURE_SLICE_DEBUG,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHOW_STRUCTURE_ANCHORS,
    SHOW_STRUCTURE_TRIANGLE_OWNERSHIP_SORT_DEBUG,
    deferredStructureSliceDebugDraws,
    LOG_STRUCTURE_OWNERSHIP_DEBUG,
    loggedStructureOwnershipDebugIds,
    buildStructureDrawables,
  } = input as any;

  let didQueueStructureCutoutDebugRect = input.didQueueStructureCutoutDebugRect ?? false;

  const buildStructureSpriteQuadPayload = (
    spriteId: string | undefined,
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
    const atlasFrame = spriteId ? (getStaticAtlasSpriteFrame?.(spriteId) ?? null) : null;
    if (!atlasFrame) {
      if (spriteId) countRenderStaticAtlasFallback();
      else countRenderStaticAtlasBypass();
    }
    const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
    const intrinsicSourceWidth = Number((draw.img as { width?: number }).width ?? 0);
    const intrinsicSourceHeight = Number((draw.img as { height?: number }).height ?? 0);
    const localSourceWidth = Number(
      atlasFrame?.sw
      ?? (intrinsicSourceWidth > 0 ? intrinsicSourceWidth : Number(draw.dw ?? 0)),
    );
    const localSourceHeight = Number(
      atlasFrame?.sh
      ?? (intrinsicSourceHeight > 0 ? intrinsicSourceHeight : Number(draw.dh ?? 0)),
    );
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

  const coarseCutoutGuardPx = 1;
  const coarseCutoutInflateX = Number(T) * Number(ISO_X) + coarseCutoutGuardPx;
  const coarseCutoutInflateY = Number(T) * Number(ISO_Y) + coarseCutoutGuardPx;
  const coarseCutoutScreenRect = {
    x: structureCutoutScreenRect.minX - coarseCutoutInflateX,
    y: structureCutoutScreenRect.minY - coarseCutoutInflateY,
    w: (structureCutoutScreenRect.maxX - structureCutoutScreenRect.minX) + coarseCutoutInflateX * 2,
    h: (structureCutoutScreenRect.maxY - structureCutoutScreenRect.minY) + coarseCutoutInflateY * 2,
  };

  const isCutoutNearGroup = (piece: any): boolean => (
    !!piece.cutoutEnabled
    && !!piece.buildingDirectionalEligible
    && !!piece.groupParentAfterPlayer
    && runtimeStructureRectIntersects(piece.groupLocalBounds, coarseCutoutScreenRect)
  );

  const sourceFrameKeyForPiece = (
    piece: any,
    atlasFrame: { image: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number } | null,
  ): string => {
    if (atlasFrame) {
      return [
        "atlas",
        piece.overlay.spriteId ?? piece.overlay.id,
        atlasFrame.sx,
        atlasFrame.sy,
        atlasFrame.sw,
        atlasFrame.sh,
      ].join(":");
    }
    const imageWidth = Number((piece.draw.img as { width?: number } | undefined)?.width ?? 0);
    const imageHeight = Number((piece.draw.img as { height?: number } | undefined)?.height ?? 0);
    return [
      "fallback",
      piece.overlay.spriteId ?? piece.overlay.id,
      imageWidth,
      imageHeight,
    ].join(":");
  };

  const processStructureTriangles = (
    piece: any,
    atlasFrame: { image: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number } | null,
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
        ? flippedSrcPoints.map((point) => ({
          x: atlasFrame.sx + Number(point.x ?? 0),
          y: atlasFrame.sy + Number(point.y ?? 0),
        }))
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
    atlasFrame: { image: HTMLCanvasElement; sx: number; sy: number; sw: number; sh: number } | null,
    processedTriangles: readonly ProcessedStructureTriangle[],
    buildDestinationQuad: DestinationQuadBuilder,
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
      const destinationQuad = buildDestinationQuad({
        cameraTx: cell.cameraTx,
        cameraTy: cell.cameraTy,
        zVisual,
        destinationBounds,
      });
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
          payload: buildStructureSpriteQuadPayload(face.spriteId, d),
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
      const wallKindOrder = occ.layerRole === "STRUCTURE" ? KindOrder.STRUCTURE : KindOrder.OCCLUDER;
      const renderKey: RenderKey = {
        slice: occ.tx + occ.ty,
        within: occ.tx,
        baseZ: occ.zFrom,
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
        payload: buildStructureSpriteQuadPayload(occ.spriteId, draw),
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
    });

    didQueueStructureCutoutDebugRect = structureSliceBuild.didQueueStructureCutoutDebugRect;

    const structureDrawables = buildStructureDrawables(structureSliceBuild.pieces);
    for (let si = 0; si < structureDrawables.length; si++) {
      const structureDrawable = structureDrawables[si];
      if (structureDrawable.payload.kind === "overlay") {
        const overlay = structureDrawable.payload.piece.overlay;
        const draw = structureDrawable.payload.piece.draw;
        countRenderStructureTotalSubmission();
        countRenderStructureRectMeshSubmission();
        countRenderStructureRectMeshMigratedToQuad();
        countRenderStructureSingleQuadSubmission();
        countRenderStructureEstimatedTrianglesAvoided(2);
        enqueueSliceCommand(frameBuilder, structureDrawable.key, {
          semanticFamily: "worldSprite",
          finalForm: "quad",
          payload: buildStructureSpriteQuadPayload(overlay.spriteId, draw),
        });
        continue;
      }

      const piece = structureDrawable.payload.piece;
      const atlasFrame = piece.overlay.spriteId ? (getStaticAtlasSpriteFrame?.(piece.overlay.spriteId) ?? null) : null;
      if (!atlasFrame) {
        if (piece.overlay.spriteId) countRenderStaticAtlasFallback();
        else countRenderStaticAtlasBypass();
      }
      const overlaySourceWidth = Number(
        ((piece.draw.img as { width?: number } | undefined)?.width ?? 0),
      );
      const sourceWidth = Number(
        atlasFrame?.sw
        ?? (overlaySourceWidth > 0 ? overlaySourceWidth : Number(piece.draw.dw ?? 0)),
      );
      const compareDistanceOnlyStableIds = new Set<number>(
        piece.compareDistanceOnlyTriangles.map((triangle: any) => triangle.stableId),
      );
      const processedTriangles = processStructureTriangles(piece, atlasFrame, sourceWidth);
      countRenderStructureMonolithicGroupSubmission();
      countRenderStructureMonolithicTriangles(processedTriangles.length);

      const extractedCells = tryBuildMonolithicCellQuadPayloads(
        piece,
        atlasFrame,
        processedTriangles,
        ({ destinationBounds }) => buildRectDestinationQuad(
          destinationBounds.minX,
          destinationBounds.minY,
          destinationBounds.maxX - destinationBounds.minX,
          destinationBounds.maxY - destinationBounds.minY,
        ),
      );
      if (extractedCells.accepted.length > 0) {
        countRenderStructureQuadApproxAccepted(extractedCells.accepted.length);
      }
      if (extractedCells.rejected > 0) {
        countRenderStructureQuadApproxRejected(extractedCells.rejected);
      }

      const shouldUseCoarseMergedSlice = !!structureMergedSliceCacheStore
        && piece.allTrianglesVisible === true
        && extractedCells.rejected <= 0
        && extractedCells.accepted.length > 1
        && !isCutoutNearGroup(piece);

      if (shouldUseCoarseMergedSlice) {
        const sourceFrameKey = sourceFrameKeyForPiece(piece, atlasFrame);
        let mergedEntry = structureMergedSliceCacheStore.get({
          structureInstanceId: piece.overlay.id,
          groupStableId: piece.stableId,
          expectedGeometrySignature: piece.geometrySignature,
          expectedSourceFrameKey: sourceFrameKey,
        });
        if (mergedEntry) {
          countRenderStructureMergedSliceCacheHit();
        } else {
          countRenderStructureMergedSliceCacheMiss();
          const mergedTriangleCount = extractedCells.accepted.reduce((total, cell) => total + cell.triangleCount, 0);
          const builtEntry = buildStructureMergedSliceCacheEntry({
            structureInstanceId: piece.overlay.id,
            groupStableId: piece.stableId,
            geometrySignature: piece.geometrySignature,
            sourceFrameKey,
            quads: extractedCells.accepted.map((cell) => cell.payload),
            triangleCount: mergedTriangleCount,
          });
          if (builtEntry) {
            structureMergedSliceCacheStore.set(builtEntry);
            countRenderStructureMergedSliceCacheRebuild();
            mergedEntry = builtEntry;
          }
        }

        if (mergedEntry) {
          countRenderStructureGroupedPreSubmission(extractedCells.accepted.length);
          countRenderStructureGroupedPostSubmission();
          countRenderStructureTotalSubmission();
          countRenderStructureSingleQuadSubmission();
          countRenderStructureMergedSliceSubmission();
          countRenderStructureEstimatedTrianglesAvoided(mergedEntry.triangleCount);
          enqueueSliceCommand(frameBuilder, structureDrawable.key, {
            semanticFamily: "worldSprite",
            finalForm: "quad",
            payload: buildRectQuadPayload({
              image: mergedEntry.canvas,
              sourceRectWidth: mergedEntry.canvas.width,
              sourceRectHeight: mergedEntry.canvas.height,
              dx: mergedEntry.bounds.x,
              dy: mergedEntry.bounds.y,
              dw: mergedEntry.bounds.w,
              dh: mergedEntry.bounds.h,
              auditFamily: "structures",
            }),
          });
        } else {
          for (let ci = 0; ci < extractedCells.accepted.length; ci++) {
            const cell = extractedCells.accepted[ci];
            countRenderStructureTotalSubmission();
            countRenderStructureSingleQuadSubmission();
            countRenderStructureEstimatedTrianglesAvoided(cell.triangleCount);
            enqueueSliceCommand(frameBuilder, structureDrawable.key, {
              semanticFamily: "worldSprite",
              finalForm: "quad",
              payload: cell.payload,
            });
          }
        }
      } else {
        for (let ci = 0; ci < extractedCells.accepted.length; ci++) {
          const cell = extractedCells.accepted[ci];
          countRenderStructureTotalSubmission();
          countRenderStructureSingleQuadSubmission();
          countRenderStructureEstimatedTrianglesAvoided(cell.triangleCount);
          enqueueSliceCommand(frameBuilder, structureDrawable.key, {
            semanticFamily: "worldSprite",
            finalForm: "quad",
            payload: cell.payload,
          });
        }
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

  return {
    didQueueStructureCutoutDebugRect,
  };
}
