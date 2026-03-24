import type { WorldPassContext, WorldPassResult } from "../contracts/worldPassContext";

export function executeWorldPasses(input: WorldPassContext): WorldPassResult {
  const {
    sliceDrawables,
    countRenderSliceKeySort,
    isWorldKindForRenderPass,
    deriveFeetSortYFromKey,
    T,
    toScreenAtZ,
    resolveRenderZBand,
    rampRoadTiles,
    countRenderDrawableSort,
    compareRenderKeys,
    structureShadowTrianglesByBand,
    structureHybridShadowByBand,
    structureV4ShadowByBand,
    structureV5ShadowByBand,
    structureShadowFrame,
    structureV6VerticalShadowDebugDataList,
    setRenderZBandCount,
    KindOrder,
    isGroundKindForRenderPass,
    setRenderPerfDrawTag,
    drawStructureShadowProjectedTriangles,
    ctx,
    STRUCTURE_SHADOW_V1_MAX_DARKNESS,
    SHADOW_HYBRID_DIAGNOSTIC_MODE,
    hybridMainCanvasDiagnosticPieces,
    countStructureHybridProjectedTriangles,
    hybridShadowDiagnosticStats,
    drawStructureHybridProjectedTrianglesSolid,
    drawStructureHybridShadowProjectedTriangles,
    SHADOW_DEBUG_MODE,
    drawStructureV4ShadowTrianglesSolid,
    drawStructureV4ShadowWarpedTriangles,
    v4ShadowDiagnosticStats,
    drawStructureV5ShadowMasks,
    shadowSunModel,
    SHADOW_V5_DEBUG_VIEW,
    SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
    SHADOW_V5_TRANSFORM_DEBUG_MODE,
    v5ShadowDiagnosticStats,
    executeDebugPass,
    drawSweepShadowBand,
  } = input as any;
  let v5ShadowAnchorDiagnostic = input.v5ShadowAnchorDiagnostic;

  // FINAL RENDER PASS: Execute by zBand with GROUND then WORLD
  // ============================================
  const sliceKeys = Array.from(sliceDrawables.keys()) as number[];
  countRenderSliceKeySort();
  sliceKeys.sort((a, b) => a - b);

  const kindToDrawTag = (kind: any): "floors" | "decals" | "entities" | "structures" | "lighting" => {
    if (kind === KindOrder.FLOOR || kind === KindOrder.SHADOW) return "floors";
    if (kind === KindOrder.DECAL) return "decals";
    if (kind === KindOrder.LIGHT) return "lighting";
    if (
      kind === KindOrder.ENTITY
      || kind === KindOrder.VFX
      || kind === KindOrder.ZONE_OBJECTIVE
    ) return "entities";
    return "structures";
  };

  // Sort once per slice and collect all zBands. WORLD keys missing feetSortY
  // get a deterministic derived value from owner tile center projection.
  const zBands = new Set<number>();
  for (let i = 0; i < sliceKeys.length; i++) {
    const drawables = sliceDrawables.get(sliceKeys[i])!;
    for (let j = 0; j < drawables.length; j++) {
      const key = drawables[j].key;
      if (isWorldKindForRenderPass(key.kindOrder) && key.feetSortY == null) {
        key.feetSortY = deriveFeetSortYFromKey(key, T, toScreenAtZ);
      }
      zBands.add(resolveRenderZBand(key, rampRoadTiles));
    }
    countRenderDrawableSort();
    drawables.sort((a: any, b: any) => compareRenderKeys(a.key, b.key));
  }
  structureShadowTrianglesByBand.forEach((triangles: any, zBand: any) => {
    if (triangles.length > 0) zBands.add(zBand);
  });
  structureHybridShadowByBand.forEach((pieces: any, zBand: any) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  structureV4ShadowByBand.forEach((pieces: any, zBand: any) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  structureV5ShadowByBand.forEach((pieces: any, zBand: any) => {
    if (pieces.length > 0) zBands.add(zBand);
  });
  if (structureShadowFrame.routing.usesV6Debug) {
    for (let i = 0; i < structureV6VerticalShadowDebugDataList.length; i++) {
      zBands.add(structureV6VerticalShadowDebugDataList[i].zBand);
    }
  }

  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);
  setRenderZBandCount(zBandKeys.length);

  for (let zi = 0; zi < zBandKeys.length; zi++) {
    const zb = zBandKeys[zi];

    // Pass 1: GROUND
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isGroundKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
    if (drawSweepShadowBand) {
      drawSweepShadowBand(zb, zBandKeys[0]);
    }
    const structureShadowBandTriangles = structureShadowTrianglesByBand.get(zb) ?? [];
    if (structureShadowBandTriangles.length > 0) {
      setRenderPerfDrawTag("floors");
      drawStructureShadowProjectedTriangles(ctx, structureShadowBandTriangles, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
    }
    const structureHybridBandPieces = structureHybridShadowByBand.get(zb) ?? [];
    if (structureHybridBandPieces.length > 0) {
      if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidMainCanvas") {
        for (let pi = 0; pi < structureHybridBandPieces.length; pi++) {
          hybridMainCanvasDiagnosticPieces.push(structureHybridBandPieces[pi]);
        }
      } else {
        const hybridTrianglesInBand = countStructureHybridProjectedTriangles(structureHybridBandPieces);
        hybridShadowDiagnosticStats.piecesDrawnShadowPass += structureHybridBandPieces.length;
        hybridShadowDiagnosticStats.trianglesDrawnShadowPass += hybridTrianglesInBand;
        hybridShadowDiagnosticStats.piecesComposited += structureHybridBandPieces.length;
        setRenderPerfDrawTag("floors");
        if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidShadowPass") {
          const drawnTriangles = drawStructureHybridProjectedTrianglesSolid(
            ctx,
            structureHybridBandPieces,
            "rgba(255, 60, 140, 0.92)",
          );
          hybridShadowDiagnosticStats.trianglesComposited += drawnTriangles;
        } else {
          drawStructureHybridShadowProjectedTriangles(ctx, structureHybridBandPieces, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
          hybridShadowDiagnosticStats.trianglesComposited += hybridTrianglesInBand;
        }
      }
    }
    const structureV4BandPieces = structureV4ShadowByBand.get(zb) ?? [];
    if (structureV4BandPieces.length > 0) {
      const bandTopCapTriangles: any[] = [];
      for (let pi = 0; pi < structureV4BandPieces.length; pi++) {
        const piece = structureV4BandPieces[pi];
        for (let ci = 0; ci < piece.topCapTriangles.length; ci++) {
          bandTopCapTriangles.push(piece.topCapTriangles[ci]);
        }
      }
      const drawFlatContribution = SHADOW_DEBUG_MODE === "flatOnly" || SHADOW_DEBUG_MODE === "both";
      const drawWarpedContribution = SHADOW_DEBUG_MODE === "warpedOnly" || SHADOW_DEBUG_MODE === "both";
      const flatShadowFill = `rgba(0,0,0,${Math.max(0, Math.min(1, STRUCTURE_SHADOW_V1_MAX_DARKNESS)).toFixed(3)})`;

      setRenderPerfDrawTag("floors");
      if (drawFlatContribution) {
        if (bandTopCapTriangles.length > 0) {
          drawStructureShadowProjectedTriangles(ctx, bandTopCapTriangles, STRUCTURE_SHADOW_V1_MAX_DARKNESS);
          v4ShadowDiagnosticStats.topCapTrianglesDrawnShadowPass += bandTopCapTriangles.length;
          v4ShadowDiagnosticStats.trianglesComposited += bandTopCapTriangles.length;
          v4ShadowDiagnosticStats.flatDrawCalls += 1;
        }
        const flatTriangles = drawStructureV4ShadowTrianglesSolid(
          ctx,
          structureV4BandPieces,
          flatShadowFill,
        );
        v4ShadowDiagnosticStats.flatTrianglesDrawnShadowPass += flatTriangles;
        v4ShadowDiagnosticStats.trianglesComposited += flatTriangles;
        if (flatTriangles > 0) {
          v4ShadowDiagnosticStats.flatDrawCalls += 1;
        }
      }
      if (drawWarpedContribution) {
        const warpedTriangles = drawStructureV4ShadowWarpedTriangles(
          ctx,
          structureV4BandPieces,
          STRUCTURE_SHADOW_V1_MAX_DARKNESS,
        );
        v4ShadowDiagnosticStats.warpedTrianglesDrawnShadowPass += warpedTriangles;
        v4ShadowDiagnosticStats.trianglesComposited += warpedTriangles;
        if (warpedTriangles > 0) {
          v4ShadowDiagnosticStats.warpedDrawCalls += 1;
        }
      }
      v4ShadowDiagnosticStats.piecesComposited += structureV4BandPieces.length;
    }
    const structureV5BandPieces = structureV5ShadowByBand.get(zb) ?? [];
    if (structureV5BandPieces.length > 0) {
      setRenderPerfDrawTag("floors");
      const v5Draw = drawStructureV5ShadowMasks(
        ctx,
        structureV5BandPieces,
        shadowSunModel.projectionDirection,
        SHADOW_V5_DEBUG_VIEW,
        STRUCTURE_SHADOW_V1_MAX_DARKNESS,
        SHOW_STRUCTURE_TRIANGLE_FOOTPRINT_DEBUG,
        SHADOW_V5_TRANSFORM_DEBUG_MODE,
      );
      v5ShadowDiagnosticStats.piecesDrawn += v5Draw.piecesDrawn;
      v5ShadowDiagnosticStats.trianglesDrawn += v5Draw.trianglesDrawn;
      v5ShadowDiagnosticStats.finalShadowDrawCalls += v5Draw.finalShadowDrawCalls;
      if (!v5ShadowAnchorDiagnostic && v5Draw.anchorDiagnostic) {
        v5ShadowAnchorDiagnostic = v5Draw.anchorDiagnostic;
      }
    }
    if (structureShadowFrame.routing.usesV6Debug && structureV6VerticalShadowDebugDataList.length > 0) {
      setRenderPerfDrawTag("floors");
      for (let i = 0; i < structureV6VerticalShadowDebugDataList.length; i++) {
        const structureShadowDebugData = structureV6VerticalShadowDebugDataList[i];
        if (structureShadowDebugData.zBand !== zb) continue;
        executeDebugPass({
          phase: "structureV6MergedMask",
          input: {
            ctx,
            debugData: structureShadowDebugData,
          },
        });
      }
    }

    // Pass 2: WORLD
    for (let si = 0; si < sliceKeys.length; si++) {
      const drawables = sliceDrawables.get(sliceKeys[si])!;
      for (let di = 0; di < drawables.length; di++) {
        const drawable = drawables[di];
        if (resolveRenderZBand(drawable.key, rampRoadTiles) !== zb) continue;
        if (!isWorldKindForRenderPass(drawable.key.kindOrder)) continue;
        setRenderPerfDrawTag(kindToDrawTag(drawable.key.kindOrder));
        drawable.drawFn(drawable.payload);
      }
    }
  }
  if (SHADOW_HYBRID_DIAGNOSTIC_MODE === "solidMainCanvas" && hybridMainCanvasDiagnosticPieces.length > 0) {
    setRenderPerfDrawTag("floors");
    const drawnTriangles = drawStructureHybridProjectedTrianglesSolid(
      ctx,
      hybridMainCanvasDiagnosticPieces,
      "rgba(40, 255, 155, 0.9)",
    );
    hybridShadowDiagnosticStats.piecesDrawnMainCanvas = hybridMainCanvasDiagnosticPieces.length;
    hybridShadowDiagnosticStats.trianglesDrawnMainCanvas = drawnTriangles;
    hybridShadowDiagnosticStats.piecesComposited += hybridMainCanvasDiagnosticPieces.length;
    hybridShadowDiagnosticStats.trianglesComposited += drawnTriangles;
  }
  setRenderPerfDrawTag(null);
  return { v5ShadowAnchorDiagnostic };
}
