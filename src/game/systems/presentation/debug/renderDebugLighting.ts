import { getRenderPerfSnapshot } from "../renderPerfCounters";
import type { RenderDebugScreenPassInput } from "./debugRenderTypes";
import { drawStructureV6FaceSliceDebugPanel } from "./renderDebugStructures";

export function renderDebugLightingOverlay(input: RenderDebugScreenPassInput): void {
  const {
    ctx,
    cssW,
    cssH,
    dpr,
    flags,
    renderPerfCountersEnabled,
    structureShadowRouting,
    structureV6VerticalShadowDebugData,
    structureV6ShadowDebugCandidateCount,
    v5ShadowAnchorDiagnostic,
    shadowSunModel,
    structureTriangleAdmissionMode,
    sliderPadding,
    playerCameraTx,
    playerCameraTy,
    structureTriangleCutoutEnabled,
    structureTriangleCutoutHalfWidth,
    structureTriangleCutoutHalfHeight,
    structureTriangleCutoutAlpha,
    roadWidthAtPlayer,
    hybridShadowDiagnosticStats,
    v4ShadowDiagnosticStats,
    v5ShadowDiagnosticStats,
  } = input;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = "12px monospace";
  ctx.fillStyle = "#fff";

  if (structureShadowRouting.usesV6 && structureV6VerticalShadowDebugData) {
    drawStructureV6FaceSliceDebugPanel(ctx, cssW, cssH, structureV6VerticalShadowDebugData);
  }

  const perf = getRenderPerfSnapshot();
  if (renderPerfCountersEnabled) {
    const tag = perf.drawImageByTagPerFrame;
    const saveTag = perf.saveByTagPerFrame;
    const restoreTag = perf.restoreByTagPerFrame;
    const perfLines = [
      `drawImage/frame: ${perf.drawImageCallsPerFrame.toFixed(1)}`,
      `tag void:${tag.void.toFixed(1)} floors:${tag.floors.toFixed(1)} decals:${tag.decals.toFixed(1)} ent:${tag.entities.toFixed(1)}`,
      `tag struct:${tag.structures.toFixed(1)}`,
      `tag lighting:${tag.lighting.toFixed(1)} untagged:${tag.untagged.toFixed(1)}`,
      `gradientCreate/frame: ${perf.gradientCreateCallsPerFrame.toFixed(1)} addColorStop/frame: ${perf.addColorStopCallsPerFrame.toFixed(1)}`,
      `save/frame: ${perf.saveCallsPerFrame.toFixed(1)} restore/frame: ${perf.restoreCallsPerFrame.toFixed(1)}`,
      `saveTag fl:${saveTag.floors.toFixed(1)} de:${saveTag.decals.toFixed(1)} li:${saveTag.lighting.toFixed(1)} un:${saveTag.untagged.toFixed(1)}`,
      `saveTag struct:${saveTag.structures.toFixed(1)}`,
      `restoreTag fl:${restoreTag.floors.toFixed(1)} de:${restoreTag.decals.toFixed(1)} li:${restoreTag.lighting.toFixed(1)} un:${restoreTag.untagged.toFixed(1)}`,
      `restoreTag struct:${restoreTag.structures.toFixed(1)}`,
      `closures/frame: ${perf.closuresCreatedPerFrame.toFixed(1)}`,
      `sliceSorts/frame: ${perf.sliceKeySortsPerFrame.toFixed(1)} drawableSorts/frame: ${perf.drawableSortsPerFrame.toFixed(1)}`,
      `fullCanvasBlits/frame: ${perf.fullCanvasBlitsPerFrame.toFixed(1)}`,
      `tileRadius: ${perf.tileLoopRadius.toFixed(0)} tileLoopIters/frame: ${perf.tileLoopIterationsPerFrame.toFixed(1)}`,
      `triAdmission: mode=${structureTriangleAdmissionMode} authority=${structureTriangleAdmissionMode === "viewport" ? "viewportRect" : "sharedRenderDistance(tileRadius)"} tileRadius=${sliderPadding}`,
      `triCutout: ${structureTriangleCutoutEnabled ? "on" : "off"} center=${playerCameraTx},${playerCameraTy} size=${structureTriangleCutoutHalfWidth}x${structureTriangleCutoutHalfHeight} alpha=${structureTriangleCutoutAlpha.toFixed(2)}`,
      `bands z:${perf.zBandCountPerFrame.toFixed(1)} light:${perf.lightBandCountPerFrame.toFixed(1)} masks build:${perf.maskBuildsPerFrame.toFixed(1)} hit:${perf.maskCacheHitsPerFrame.toFixed(1)} miss:${perf.maskCacheMissesPerFrame.toFixed(1)}`,
      `masks rasterChunks/frame: ${perf.maskRasterChunksPerFrame.toFixed(1)} drawEntries/frame: ${perf.maskDrawEntriesPerFrame.toFixed(1)}`,
    ];
    ctx.textAlign = "right";
    const perfX = cssW - 8;
    const perfLineH = 16;
    const perfY0 = cssH - 8 - perfLineH * (perfLines.length - 1);
    for (let i = 0; i < perfLines.length; i++) {
      ctx.fillText(perfLines[i], perfX, perfY0 + i * perfLineH);
    }
    ctx.textAlign = "left";
  }

  let screenDebugLineY = 30;
  if (flags.showStructureTriangleFootprint) {
    const forward = shadowSunModel.forward;
    const projection = shadowSunModel.projectionDirection;
    const sunLine = `shadowSun ${shadowSunModel.timeLabel} caster:${flags.shadowCasterMode} elev:${shadowSunModel.elevationDeg.toFixed(1)} dir:${shadowSunModel.directionLabel} f(${forward.x.toFixed(3)},${forward.y.toFixed(3)},${forward.z.toFixed(3)}) p(${projection.x.toFixed(3)},${projection.y.toFixed(3)}) step:${shadowSunModel.stepKey}`;
    ctx.fillText(sunLine, 8, screenDebugLineY);
    screenDebugLineY += 16;
    if (structureShadowRouting.usesHybrid) {
      const hybridLine = `hybridDiag mode:${flags.shadowHybridDiagnosticMode} cache h:${hybridShadowDiagnosticStats.cacheHits} m:${hybridShadowDiagnosticStats.cacheMisses} cast:${hybridShadowDiagnosticStats.casterTriangles} proj:${hybridShadowDiagnosticStats.projectedTriangles} queue p:${hybridShadowDiagnosticStats.piecesQueued} t:${hybridShadowDiagnosticStats.trianglesQueued} pass p:${hybridShadowDiagnosticStats.piecesDrawnShadowPass} t:${hybridShadowDiagnosticStats.trianglesDrawnShadowPass} main p:${hybridShadowDiagnosticStats.piecesDrawnMainCanvas} t:${hybridShadowDiagnosticStats.trianglesDrawnMainCanvas} comp p:${hybridShadowDiagnosticStats.piecesComposited} t:${hybridShadowDiagnosticStats.trianglesComposited}`;
      ctx.fillText(hybridLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
    } else if (structureShadowRouting.usesV4) {
      const v4Line = `v4Diag mode:${v4ShadowDiagnosticStats.renderMode} cache h:${v4ShadowDiagnosticStats.cacheHits} m:${v4ShadowDiagnosticStats.cacheMisses} cap:${v4ShadowDiagnosticStats.topCapTriangles} corr:${v4ShadowDiagnosticStats.correspondences} strips:${v4ShadowDiagnosticStats.strips} edges:${v4ShadowDiagnosticStats.layerEdges} bands:${v4ShadowDiagnosticStats.layerBands} srcTri:${v4ShadowDiagnosticStats.sourceBandTriangles} dstTri:${v4ShadowDiagnosticStats.destinationBandEntries} map:${v4ShadowDiagnosticStats.correspondencePairs} mismatch:${v4ShadowDiagnosticStats.correspondenceMismatches} queue p:${v4ShadowDiagnosticStats.piecesQueued} stripT:${v4ShadowDiagnosticStats.trianglesQueued} capT:${v4ShadowDiagnosticStats.topCapTrianglesQueued} draw capPass:${v4ShadowDiagnosticStats.topCapTrianglesDrawnShadowPass} capMain:${v4ShadowDiagnosticStats.topCapTrianglesDrawnMainCanvas} warp:${v4ShadowDiagnosticStats.warpedTrianglesDrawnShadowPass} flatPass:${v4ShadowDiagnosticStats.flatTrianglesDrawnShadowPass} flatMain:${v4ShadowDiagnosticStats.flatTrianglesDrawnMainCanvas} calls warp:${v4ShadowDiagnosticStats.warpedDrawCalls} flat:${v4ShadowDiagnosticStats.flatDrawCalls} comp p:${v4ShadowDiagnosticStats.piecesComposited} t:${v4ShadowDiagnosticStats.trianglesComposited} triPairs:${v4ShadowDiagnosticStats.destinationBandPairs} tri:${v4ShadowDiagnosticStats.destinationTriangles} diag:${v4ShadowDiagnosticStats.diagonalRule} deltaConst pass:${v4ShadowDiagnosticStats.deltaConstPass} fail:${v4ShadowDiagnosticStats.deltaConstFail} ${v4ShadowDiagnosticStats.firstSliceSummary}`;
      ctx.fillText(v4Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
      const v4SampleLine = `v4Sample roofH:${v4ShadowDiagnosticStats.sampleRoofHeightPx ?? "none"} heights:${v4ShadowDiagnosticStats.sampleLayerHeights} slices:${v4ShadowDiagnosticStats.sampleSliceCount} edges:${v4ShadowDiagnosticStats.sampleLayerEdges} bands:${v4ShadowDiagnosticStats.sampleLayerBands} ${v4ShadowDiagnosticStats.sampleSelectedSlice}`;
      ctx.fillText(v4SampleLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
      const v4BandLine = `v4Band ${v4ShadowDiagnosticStats.sampleSelectedBand}`;
      ctx.fillText(v4BandLine, 8, screenDebugLineY);
      screenDebugLineY += 16;
    } else if (structureShadowRouting.usesV5) {
      const v5Line = `v5Diag view:${flags.shadowV5DebugView} xf:${flags.shadowV5TransformDebugMode} queue p:${v5ShadowDiagnosticStats.piecesQueued} t:${v5ShadowDiagnosticStats.trianglesQueued} draw p:${v5ShadowDiagnosticStats.piecesDrawn} t:${v5ShadowDiagnosticStats.trianglesDrawn} finalCalls:${v5ShadowDiagnosticStats.finalShadowDrawCalls}`;
      ctx.fillText(v5Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
      if (v5ShadowAnchorDiagnostic) {
        const d = v5ShadowAnchorDiagnostic;
        const v5SpaceLineA = [
          `v5Space id:${d.structureInstanceId}`,
          `dst:${d.triangleDestinationSpace}`,
          `maskOrigin(${d.maskCanvasOrigin.x.toFixed(1)},${d.maskCanvasOrigin.y.toFixed(1)})`,
          `buildOrigin(${d.buildingDrawOrigin.x.toFixed(1)},${d.buildingDrawOrigin.y.toFixed(1)})`,
          `xformOrigin(${d.transformedMaskDrawOrigin.x.toFixed(1)},${d.transformedMaskDrawOrigin.y.toFixed(1)})`,
          `finalOrigin(${d.finalShadowDrawOrigin.x.toFixed(1)},${d.finalShadowDrawOrigin.y.toFixed(1)})`,
        ].join(" ");
        ctx.fillText(v5SpaceLineA, 8, screenDebugLineY);
        screenDebugLineY += 16;
        const v5SpaceLineB = [
          `v5Anchor mask(${d.maskAnchor.x.toFixed(1)},${d.maskAnchor.y.toFixed(1)})`,
          `build(${d.buildingAnchor.x.toFixed(1)},${d.buildingAnchor.y.toFixed(1)})`,
          `xform(${d.transformedAnchor.x.toFixed(1)},${d.transformedAnchor.y.toFixed(1)})`,
          `offset(${d.offset.x.toFixed(2)},${d.offset.y.toFixed(2)})`,
          `raw[${d.rawBounds.minX.toFixed(1)},${d.rawBounds.minY.toFixed(1)}→${d.rawBounds.maxX.toFixed(1)},${d.rawBounds.maxY.toFixed(1)}]`,
          `xraw[${d.transformedBounds.minX.toFixed(1)},${d.transformedBounds.minY.toFixed(1)}→${d.transformedBounds.maxX.toFixed(1)},${d.transformedBounds.maxY.toFixed(1)}]`,
        ].join(" ");
        ctx.fillText(v5SpaceLineB, 8, screenDebugLineY);
        screenDebugLineY += 16;
      }
    } else if (structureShadowRouting.usesV6) {
      const selectedId = structureV6VerticalShadowDebugData?.structureInstanceId ?? "none";
      const bucketATris = structureV6VerticalShadowDebugData?.bucketAShadow?.sourceTriangleCount ?? 0;
      const bucketBTriCount = structureV6VerticalShadowDebugData?.bucketBShadow?.sourceTriangleCount ?? 0;
      const topTriCount = structureV6VerticalShadowDebugData?.topShadow?.sourceTriangleCount ?? 0;
      const bucketACastSlices = structureV6VerticalShadowDebugData?.bucketAShadow?.nonEmptySliceCount ?? 0;
      const bucketBCastSlices = structureV6VerticalShadowDebugData?.bucketBShadow?.nonEmptySliceCount ?? 0;
      const topCastSlices = structureV6VerticalShadowDebugData?.topShadow?.nonEmptySliceCount ?? 0;
      const shadowVector = structureV6VerticalShadowDebugData?.shadowVector ?? { x: 0, y: 0 };
      const v6Line = `v6.7Diag buckets:${flags.shadowV6PrimarySemanticBucket}+${flags.shadowV6SecondarySemanticBucket}+${flags.shadowV6TopSemanticBucket} reqBucket:${flags.shadowV6RequestedSemanticBucket} structReq:${flags.shadowV6StructureIndex} selected:${selectedId} candidates:${structureV6ShadowDebugCandidateCount} triEW:${bucketATris} triSN:${bucketBTriCount} triTOP:${topTriCount} castEW:${bucketACastSlices} castSN:${bucketBCastSlices} castTOP:${topCastSlices} vec(${shadowVector.x.toFixed(1)},${shadowVector.y.toFixed(1)})`;
      ctx.fillText(v6Line, 8, screenDebugLineY);
      screenDebugLineY += 16;
    }
  }

  if (flags.showRoadSemantic) {
    ctx.fillText(`roadW(player): ${roadWidthAtPlayer}`, 8, screenDebugLineY);
  }
  ctx.restore();
}
