import type { RenderCollectionContext } from "./collectFrameDrawables";

type RenderKey = any;

export function collectStructureDrawables(input: RenderCollectionContext): {
  didQueueStructureCutoutDebugRect: boolean;
  structureV6VerticalShadowDebugData: unknown;
} {
  const {
    DISABLE_WALLS_AND_CURTAINS,
    isTileInRenderRadius,
    buildFaceDraws,
    facePieceLayers,
    facePiecesInViewForLayer,
    viewRect,
    KindOrder,
    addToSlice,
    drawRenderPiece,
    occluderLayers,
    occludersInViewForLayer,
    shouldCullBuildingAt,
    buildWallDraw,
    CONTAINER_WALL_SORT_BIAS,
    resolveStructureOverlayAdmissionContext,
    compiledMap,
    strictViewportTileBounds,
    structureTriangleGeometryEnabled,
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
    runtimeStructureTriangleCacheStore,
    getFlippedOverlayImage,
    SHOW_STRUCTURE_SLICE_DEBUG,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHADOW_V1_DEBUG_GEOMETRY_MODE,
    deferredStructureSliceDebugDraws,
    LOG_STRUCTURE_OWNERSHIP_DEBUG,
    loggedStructureOwnershipDebugIds,
    queueStructureShadowTrianglesForBand,
    queueStructureHybridShadowForBand,
    queueStructureV4ShadowForBand,
    queueStructureV5ShadowForBand,
    structureV6ShadowDebugCandidates,
    hybridShadowDiagnosticStats,
    v4ShadowDiagnosticStats,
    v5ShadowDiagnosticStats,
    staticRelight,
    structureShadowV1CacheStore,
    structureShadowV2CacheStore,
    structureShadowHybridCacheStore,
    structureShadowV4CacheStore,
    buildStructureDrawables,
    drawStructureDrawableFn,
    buildStructureV6VerticalShadowFrameResult,
    SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    SHADOW_V6_STRUCTURE_INDEX,
    SHADOW_V6_SLICE_COUNT,
    STRUCTURE_SHADOW_V5_LENGTH_PX,
    countStructureV6CandidateTrianglesForBucket,
    resolveStructureV6SelectedCandidateIndex,
    buildStructureV6VerticalShadowMaskDebugData,
  } = input as any;

  let didQueueStructureCutoutDebugRect = input.didQueueStructureCutoutDebugRect ?? false;
  let structureV6VerticalShadowDebugData: unknown = input.structureV6VerticalShadowDebugData ?? null;

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
        addToSlice(face.tx + face.ty, renderKey, () => {
          drawRenderPiece(d);
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
      addToSlice(occ.tx + occ.ty, renderKey, () => {
        drawRenderPiece(draw);
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
      structureTriangleGeometryEnabled,
      structureTriangleAdmissionMode,
    });

    const structureOverlayCandidates = collectStructureOverlays({
      showMapOverlays: debugFlags.showMapOverlays,
      admission: structureAdmission,
      structureTriangleGeometryEnabled,
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
      structureTriangleGeometryEnabled,
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
      runtimeStructureTriangleCacheStore,
      getFlippedOverlayImage,
      showStructureSliceDebug: SHOW_STRUCTURE_SLICE_DEBUG,
      showStructureTriangleFootprintDebug: SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
      shadowV1DebugGeometryMode: SHADOW_V1_DEBUG_GEOMETRY_MODE,
      deferredStructureSliceDebugDraws,
      didQueueStructureCutoutDebugRect,
      logStructureOwnershipDebug: LOG_STRUCTURE_OWNERSHIP_DEBUG,
      loggedStructureOwnershipDebugIds,
      shadowQueueCallbacks: {
        queueStructureShadowTrianglesForBand,
        queueStructureHybridShadowForBand,
        queueStructureV4ShadowForBand,
        queueStructureV5ShadowForBand,
        structureV6ShadowDebugCandidates,
      },
      shadowDiagnostics: {
        hybrid: hybridShadowDiagnosticStats,
        v4: v4ShadowDiagnosticStats,
        v5: v5ShadowDiagnosticStats,
      },
      staticRelightFrame: staticRelight.frame,
      structureShadowV1CacheStore,
      structureShadowV2CacheStore,
      structureShadowHybridCacheStore,
      structureShadowV4CacheStore,
    });

    didQueueStructureCutoutDebugRect = structureSliceBuild.didQueueStructureCutoutDebugRect;

    const structureDrawables = buildStructureDrawables(structureSliceBuild.pieces);
    for (let si = 0; si < structureDrawables.length; si++) {
      const structureDrawable = structureDrawables[si];
      addToSlice(
        structureDrawable.slice,
        structureDrawable.key,
        drawStructureDrawableFn,
        structureDrawable.payload,
      );
    }
  }

  structureV6VerticalShadowDebugData = buildStructureV6VerticalShadowFrameResult({
    frame: structureShadowFrame,
    candidates: structureV6ShadowDebugCandidates,
    primarySemanticBucket: SHADOW_V6_PRIMARY_SEMANTIC_BUCKET,
    requestedSemanticBucket: SHADOW_V6_REQUESTED_SEMANTIC_BUCKET,
    requestedStructureIndex: SHADOW_V6_STRUCTURE_INDEX,
    requestedSliceCount: SHADOW_V6_SLICE_COUNT,
    shadowLengthPx: STRUCTURE_SHADOW_V5_LENGTH_PX,
    countCandidateTrianglesForBucket: countStructureV6CandidateTrianglesForBucket,
    resolveSelectedCandidateIndex: resolveStructureV6SelectedCandidateIndex,
    buildVerticalDebugData: buildStructureV6VerticalShadowMaskDebugData,
  });

  // ============================================

  return {
    didQueueStructureCutoutDebugRect,
    structureV6VerticalShadowDebugData,
  };
}
