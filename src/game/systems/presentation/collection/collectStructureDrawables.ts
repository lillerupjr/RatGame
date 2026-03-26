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
  buildTriangleMeshFromRect,
  buildTriangleMeshPayload,
  resolveTriangleCutoutAlpha,
} from "../renderCommandGeometry";

type RenderKey = any;

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

  const normalizeRenderPieceToMesh = (draw: {
    img: CanvasImageSource;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    flipX?: boolean;
    scale?: number;
  }, stableId?: number) => {
    const scale = Number.isFinite(Number(draw.scale)) ? Number(draw.scale) : 1;
    return buildTriangleMeshFromRect({
      image: draw.img,
      sourceWidth: Number(draw.dw ?? 0),
      sourceHeight: Number(draw.dh ?? 0),
      dx: Number(draw.dx ?? 0),
      dy: Number(draw.dy ?? 0),
      dw: Number(draw.dw ?? 0) * scale,
      dh: Number(draw.dh ?? 0) * scale,
      flipX: !!draw.flipX,
      stableId,
    });
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
        enqueueSliceCommand(frameBuilder, renderKey, face.kind === "WALL"
          ? {
              semanticFamily: "worldGeometry",
              finalForm: "triangles",
              payload: normalizeRenderPieceToMesh(d, renderKey.stableId),
            }
          : {
              semanticFamily: "worldGeometry",
              finalForm: "triangles",
              payload: normalizeRenderPieceToMesh(d, renderKey.stableId),
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
      enqueueSliceCommand(frameBuilder, renderKey, {
        semanticFamily: "worldGeometry",
        finalForm: "triangles",
        payload: normalizeRenderPieceToMesh(draw, renderKey.stableId),
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

        enqueueSliceCommand(frameBuilder, structureDrawable.key, {
          semanticFamily: "worldGeometry",
          finalForm: "triangles",
          payload: normalizeRenderPieceToMesh(draw, structureDrawable.key.stableId),
        });
        continue;
      }

      const piece = structureDrawable.payload.piece;
      const sourceWidth = Number(piece.draw.dw ?? 0);
      const sourceHeight = Number(piece.draw.dh ?? 0);
      const compareDistanceOnlyStableIds = new Set<number>(
        piece.compareDistanceOnlyTriangles.map((triangle: any) => triangle.stableId),
      );
      const normalizedTriangles = piece.finalVisibleTriangles.map((triangle: any) => {
        const srcPoints = triangle.srcPoints.map((point: any) => ({
          x: !!piece.draw.flipX ? sourceWidth - Number(point.x ?? 0) : Number(point.x ?? 0),
          y: Number(point.y ?? 0),
        }));
        const dstPoints = triangle.points.map((point: any) => ({
          x: Number(point.x ?? 0),
          y: Number(point.y ?? 0),
        }));
        return {
          stableId: triangle.stableId,
          srcPoints: [srcPoints[0], srcPoints[1], srcPoints[2]],
          dstPoints: [dstPoints[0], dstPoints[1], dstPoints[2]],
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
      });

      enqueueSliceCommand(frameBuilder, structureDrawable.key, {
        semanticFamily: "worldGeometry",
        finalForm: "triangles",
        payload: buildTriangleMeshPayload({
          image: piece.draw.img,
          sourceWidth,
          sourceHeight,
          triangles: normalizedTriangles,
        }),
      });

      if (compareDistanceOnlyStableIds.size > 0) {
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
