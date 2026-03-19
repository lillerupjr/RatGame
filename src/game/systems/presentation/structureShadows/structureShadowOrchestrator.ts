import type { StampOverlay } from "../../../map/compile/kenneyMap";
import type { ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import type {
  RuntimeStructureTriangleCache,
  RuntimeStructureTrianglePiece,
  RuntimeStructureTriangleRect,
} from "../runtimeStructureTriangles";
import {
  STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
  buildStructureShadowCacheEntry,
  type StructureShadowCacheEntry,
  type StructureShadowCacheStore,
  type StructureShadowProjectedTriangle,
} from "../structureShadowV1";
import {
  STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
  STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
  STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
  buildStructureShadowV2CacheEntry,
  type StructureShadowV2CacheEntry,
  type StructureShadowV2CacheStore,
} from "../structureShadowV2AlphaSilhouette";
import {
  buildHybridTriangleSemanticMap,
  buildStructureShadowHybridCacheEntry,
  resolveHybridSemanticMaskBuckets,
  type StructureHybridShadowProjectedTriangle,
  type StructureShadowHybridCacheEntry,
  type StructureShadowHybridCacheStore,
} from "../structureShadowHybridTriangles";
import {
  buildStructureShadowV4CacheEntry,
  type SliceCorrespondence,
  type StructureShadowV4CacheEntry,
  type StructureShadowV4CacheStore,
} from "../structureShadowV4";
import type {
  StructureShadowFrameResult,
  StructureShadowOverlayQueueResult,
  StructureV4ShadowRenderPiece,
  StructureV5ShadowMaskTriangle,
  StructureV5ShadowRenderPiece,
  StructureV6ShadowDebugCandidate,
} from "./structureShadowTypes";

type HybridShadowDiagnosticsLike = {
  cacheHits: number;
  cacheMisses: number;
  casterTriangles: number;
  projectedTriangles: number;
};

type V4ShadowDiagnosticsLike = {
  cacheHits: number;
  cacheMisses: number;
  correspondences: number;
  strips: number;
  layerEdges: number;
  layerBands: number;
  sourceBandTriangles: number;
  destinationBandEntries: number;
  correspondencePairs: number;
  correspondenceMismatches: number;
  topCapTriangles: number;
  destinationBandPairs: number;
  destinationTriangles: number;
  diagonalA: number;
  diagonalB: number;
  diagonalRule: string;
  deltaConstPass: number;
  deltaConstFail: number;
  firstSliceSummary: string;
  sampleRoofHeightPx: number | null;
  sampleLayerHeights: string;
  sampleSliceCount: number;
  sampleLayerEdges: number;
  sampleLayerBands: number;
  sampleSelectedSlice: string;
  sampleSelectedBand: string;
};

export type StructureShadowOrchestratorCacheStores = {
  v1: StructureShadowCacheStore;
  v2: StructureShadowV2CacheStore;
  hybrid: StructureShadowHybridCacheStore;
  v4: StructureShadowV4CacheStore;
};

export type BuildStructureShadowFrameResultInput = {
  frame: StructureShadowFrameResult;
  overlay: StampOverlay;
  triangleCache: RuntimeStructureTriangleCache;
  geometrySignature: string;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => { x: number; y: number };
  draw: {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    scale?: number;
  };
  sourceImage: CanvasImageSource;
  admittedTrianglesForSemanticMasks: readonly RuntimeStructureTrianglePiece[];
  projectedViewportRect: RuntimeStructureTriangleRect;
  projectedRectIntersects: (
    a: RuntimeStructureTriangleRect,
    b: RuntimeStructureTriangleRect,
  ) => boolean;
  structureShadowBand: number;
  v6PrimarySemanticBucket: ShadowV6SemanticBucket;
  v6SecondarySemanticBucket: ShadowV6SemanticBucket;
  v6TopSemanticBucket: ShadowV6SemanticBucket;
  cacheStores: StructureShadowOrchestratorCacheStores;
  diagnostics: {
    hybrid: HybridShadowDiagnosticsLike;
    v4: V4ShadowDiagnosticsLike;
  };
};

export function buildStructureShadowFrameResult(
  input: BuildStructureShadowFrameResultInput,
): StructureShadowOverlayQueueResult {
  const { frame, overlay, triangleCache, geometrySignature } = input;
  let structureShadowV1CacheEntry: StructureShadowCacheEntry | null = null;
  let structureShadowV2CacheEntry: StructureShadowV2CacheEntry | null = null;
  let structureShadowHybridCacheEntry: StructureShadowHybridCacheEntry | null = null;
  let structureShadowV4CacheEntry: StructureShadowV4CacheEntry | null = null;
  let projectedStructureShadowTriangles: readonly StructureShadowProjectedTriangle[] = [];
  let projectedStructureShadowBounds: RuntimeStructureTriangleRect | null = null;
  let hybridProjectedMappings: readonly StructureHybridShadowProjectedTriangle[] = [];
  let structureShadowCacheHit = false;

  if (frame.routing.usesHybrid || frame.routing.usesV4 || frame.routing.usesV5 || frame.routing.usesV6) {
    const cachedStructureShadowHybrid = input.cacheStores.hybrid.get(
      overlay.id,
      geometrySignature,
      frame.sunModel.stepKey,
    );
    if (cachedStructureShadowHybrid) {
      structureShadowHybridCacheEntry = cachedStructureShadowHybrid;
      structureShadowCacheHit = true;
      if (frame.routing.usesHybrid) input.diagnostics.hybrid.cacheHits += 1;
    } else {
      const rebuiltStructureShadowHybrid = buildStructureShadowHybridCacheEntry({
        overlay,
        triangleCache,
        geometrySignature,
        tileWorld: input.tileWorld,
        toScreenAtZ: input.toScreenAtZ,
        sunForward: frame.sunModel.forward,
        sunProjectionDirection: frame.sunModel.projectionDirection,
        sunStepKey: frame.sunModel.stepKey,
        roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
      });
      structureShadowHybridCacheEntry = rebuiltStructureShadowHybrid;
      input.cacheStores.hybrid.set(rebuiltStructureShadowHybrid);
      structureShadowCacheHit = false;
      if (frame.routing.usesHybrid) input.diagnostics.hybrid.cacheMisses += 1;
    }

    if (frame.routing.usesV4) {
      const cachedStructureShadowV4 = input.cacheStores.v4.get(
        overlay.id,
        geometrySignature,
        frame.sunModel.stepKey,
      );
      if (cachedStructureShadowV4) {
        structureShadowV4CacheEntry = cachedStructureShadowV4;
        structureShadowCacheHit = true;
        input.diagnostics.v4.cacheHits += 1;
      } else {
        const correspondences: SliceCorrespondence[] = structureShadowHybridCacheEntry.slicePerimeterSegments.map((segment) => ({
          sliceIndex: segment.sliceIndex,
          sourceBandIndex: segment.bandIndex,
          baseSegment: {
            a: { x: segment.baseSegment[0].x, y: segment.baseSegment[0].y },
            b: { x: segment.baseSegment[1].x, y: segment.baseSegment[1].y },
          },
          topSegment: {
            a: { x: segment.topSegment[0].x, y: segment.topSegment[0].y },
            b: { x: segment.topSegment[1].x, y: segment.topSegment[1].y },
          },
        }));
        const bandOwnerParity = new Map<number, 0 | 1>();
        for (let ti = 0; ti < triangleCache.triangles.length; ti++) {
          const tri = triangleCache.triangles[ti];
          if (bandOwnerParity.has(tri.bandIndex)) continue;
          bandOwnerParity.set(tri.bandIndex, ((tri.parentTx + tri.parentTy) & 1) as 0 | 1);
        }
        let parityAnchorBandIndex: number | null = null;
        let parityAnchorValue: 0 | 1 = 0;
        if (bandOwnerParity.size > 0) {
          const orderedBands = Array.from(bandOwnerParity.keys()).sort((a, b) => a - b);
          parityAnchorBandIndex = orderedBands[0];
          parityAnchorValue = bandOwnerParity.get(parityAnchorBandIndex) ?? 0;
        }
        const sliceOwnerParity = new Map<number, 0 | 1>();
        for (let si = 0; si < structureShadowHybridCacheEntry.slicePerimeterSegments.length; si++) {
          const segment = structureShadowHybridCacheEntry.slicePerimeterSegments[si];
          let parity = bandOwnerParity.get(segment.bandIndex);
          if (parity == null && parityAnchorBandIndex != null) {
            parity = ((parityAnchorValue + ((segment.bandIndex - parityAnchorBandIndex) & 1)) & 1) as 0 | 1;
          }
          if (parity != null) sliceOwnerParity.set(segment.sliceIndex, parity);
        }
        const rebuiltStructureShadowV4 = buildStructureShadowV4CacheEntry({
          structureInstanceId: overlay.id,
          geometrySignature,
          sunStepKey: frame.sunModel.stepKey,
          castHeightPx: structureShadowHybridCacheEntry.castHeightPx,
          sunDirection: frame.sunModel.projectionDirection,
          sliceCorrespondence: correspondences,
          topCapTriangles: structureShadowHybridCacheEntry.projectedTopCapTriangles,
          sourceTriangles: triangleCache.triangles,
          sliceOwnerParity,
        });
        structureShadowV4CacheEntry = rebuiltStructureShadowV4;
        input.cacheStores.v4.set(rebuiltStructureShadowV4);
        structureShadowCacheHit = false;
        input.diagnostics.v4.cacheMisses += 1;
      }
      projectedStructureShadowBounds = structureShadowV4CacheEntry.projectedBounds;
      input.diagnostics.v4.correspondences += structureShadowV4CacheEntry.correspondences.length;
      input.diagnostics.v4.strips += structureShadowV4CacheEntry.sliceStrips.length;
      input.diagnostics.v4.layerEdges += structureShadowV4CacheEntry.layerEdges.length;
      input.diagnostics.v4.layerBands += structureShadowV4CacheEntry.layerBands.length;
      input.diagnostics.v4.topCapTriangles += structureShadowV4CacheEntry.topCapTriangles.length;
      input.diagnostics.v4.sourceBandTriangles += structureShadowV4CacheEntry.sourceBandTriangles.length;
      input.diagnostics.v4.destinationBandEntries += structureShadowV4CacheEntry.destinationBandEntries.length;
      input.diagnostics.v4.correspondencePairs += structureShadowV4CacheEntry.triangleCorrespondence.length;
      input.diagnostics.v4.correspondenceMismatches += structureShadowV4CacheEntry.triangleCorrespondenceMismatches.length;
      input.diagnostics.v4.destinationBandPairs += structureShadowV4CacheEntry.destinationBandTriangles.length;
      input.diagnostics.v4.destinationTriangles += structureShadowV4CacheEntry.destinationTriangles.length;
      for (let di = 0; di < structureShadowV4CacheEntry.destinationBandTriangles.length; di++) {
        if (structureShadowV4CacheEntry.destinationBandTriangles[di].diagonal === "A_to_Bprime") {
          input.diagnostics.v4.diagonalA += 1;
        } else {
          input.diagnostics.v4.diagonalB += 1;
        }
      }
      input.diagnostics.v4.diagonalRule = `A:${input.diagnostics.v4.diagonalA} B:${input.diagnostics.v4.diagonalB}`;
      if (structureShadowV4CacheEntry.isDeltaConstant) {
        input.diagnostics.v4.deltaConstPass += 1;
      } else {
        input.diagnostics.v4.deltaConstFail += 1;
      }
      const firstDiagnostic = structureShadowV4CacheEntry.midpointDiagnostics[0];
      if (firstDiagnostic) {
        input.diagnostics.v4.firstSliceSummary = `i${firstDiagnostic.sliceIndex} b(${firstDiagnostic.baseMidpoint.x.toFixed(1)},${firstDiagnostic.baseMidpoint.y.toFixed(1)}) t(${firstDiagnostic.topMidpoint.x.toFixed(1)},${firstDiagnostic.topMidpoint.y.toFixed(1)}) d(${firstDiagnostic.delta.x.toFixed(1)},${firstDiagnostic.delta.y.toFixed(1)})`;
      }
      if (input.diagnostics.v4.sampleRoofHeightPx == null) {
        input.diagnostics.v4.sampleRoofHeightPx = structureShadowV4CacheEntry.roofHeightPx;
        input.diagnostics.v4.sampleLayerHeights = structureShadowV4CacheEntry.layerHeightsPx.join(",");
        input.diagnostics.v4.sampleSliceCount = structureShadowV4CacheEntry.sliceStrips.length;
        input.diagnostics.v4.sampleLayerEdges = structureShadowV4CacheEntry.layerEdges.length;
        input.diagnostics.v4.sampleLayerBands = structureShadowV4CacheEntry.layerBands.length;
        const selectedSlice = structureShadowV4CacheEntry.sliceStrips[0];
        if (selectedSlice) {
          const selectedEdges = structureShadowV4CacheEntry.layerEdges.filter((edge) => edge.sliceIndex === selectedSlice.sliceIndex);
          const layer0 = selectedEdges[0];
          const layerLast = selectedEdges[selectedEdges.length - 1];
          input.diagnostics.v4.sampleSelectedSlice = [
            `i${selectedSlice.sliceIndex}`,
            `baseA(${selectedSlice.baseA.x.toFixed(1)},${selectedSlice.baseA.y.toFixed(1)})`,
            `baseB(${selectedSlice.baseB.x.toFixed(1)},${selectedSlice.baseB.y.toFixed(1)})`,
            `topA(${selectedSlice.topA.x.toFixed(1)},${selectedSlice.topA.y.toFixed(1)})`,
            `topB(${selectedSlice.topB.x.toFixed(1)},${selectedSlice.topB.y.toFixed(1)})`,
            layer0
              ? `L0A(${layer0.a.x.toFixed(1)},${layer0.a.y.toFixed(1)}) L0B(${layer0.b.x.toFixed(1)},${layer0.b.y.toFixed(1)})`
              : "L0(none)",
            layerLast
              ? `LTA(${layerLast.a.x.toFixed(1)},${layerLast.a.y.toFixed(1)}) LTB(${layerLast.b.x.toFixed(1)},${layerLast.b.y.toFixed(1)})`
              : "LT(none)",
          ].join(" ");
          const selectedBand = structureShadowV4CacheEntry.layerBands.find(
            (band) => band.sliceIndex === selectedSlice.sliceIndex && band.bandIndex === 0,
          );
          const selectedPair = structureShadowV4CacheEntry.destinationBandTriangles.find(
            (pair) => pair.sliceIndex === selectedSlice.sliceIndex && pair.bandIndex === 0,
          );
          if (selectedBand && selectedPair) {
            const t0 = selectedPair.tri0;
            const t1 = selectedPair.tri1;
            const selectedGroup = structureShadowV4CacheEntry.triangleCorrespondenceGroups.find(
              (group) => group.sliceIndex === selectedBand.sliceIndex && group.bandIndex === selectedBand.bandIndex,
            );
            const groupSummary = selectedGroup
              ? [
                  `src:${selectedGroup.sourceTriangles.length}`,
                  `dst:${selectedGroup.destinationTriangles.length}`,
                  `map:${selectedGroup.correspondences.length}`,
                  selectedGroup.mismatch
                    ? `mismatch:${selectedGroup.mismatch.sourceTriangleCount}/${selectedGroup.mismatch.destinationTriangleCount}`
                    : "mismatch:none",
                ].join(" ")
              : "src:0 dst:0 map:0 mismatch:none";
            const pairSummary = selectedGroup?.correspondences[0]
              ? `pair sIdx:${selectedGroup.correspondences[0].sourceTriangleIndexWithinBand}->dIdx:${selectedGroup.correspondences[0].destinationTriangleIndex}`
              : "pair:none";
            input.diagnostics.v4.sampleSelectedBand = [
              `i${selectedBand.sliceIndex} b${selectedBand.bandIndex}`,
              `lowerA(${selectedBand.lowerA.x.toFixed(1)},${selectedBand.lowerA.y.toFixed(1)})`,
              `lowerB(${selectedBand.lowerB.x.toFixed(1)},${selectedBand.lowerB.y.toFixed(1)})`,
              `upperA(${selectedBand.upperA.x.toFixed(1)},${selectedBand.upperA.y.toFixed(1)})`,
              `upperB(${selectedBand.upperB.x.toFixed(1)},${selectedBand.upperB.y.toFixed(1)})`,
              `tri0[(${t0[0].x.toFixed(1)},${t0[0].y.toFixed(1)}),(${t0[1].x.toFixed(1)},${t0[1].y.toFixed(1)}),(${t0[2].x.toFixed(1)},${t0[2].y.toFixed(1)})]`,
              `tri1[(${t1[0].x.toFixed(1)},${t1[0].y.toFixed(1)}),(${t1[1].x.toFixed(1)},${t1[1].y.toFixed(1)}),(${t1[2].x.toFixed(1)},${t1[2].y.toFixed(1)})]`,
              groupSummary,
              pairSummary,
            ].join(" ");
          }
        }
      }
    } else if (frame.routing.usesHybrid) {
      hybridProjectedMappings = structureShadowHybridCacheEntry.projectedMappings;
      projectedStructureShadowBounds = structureShadowHybridCacheEntry.projectedBounds;
      input.diagnostics.hybrid.casterTriangles += structureShadowHybridCacheEntry.casterTriangles.length;
      input.diagnostics.hybrid.projectedTriangles += structureShadowHybridCacheEntry.projectedMappings.length;
    }
  } else if (frame.routing.usesV2) {
    const cachedStructureShadowV2 = input.cacheStores.v2.get(
      overlay.id,
      geometrySignature,
      frame.sunModel.stepKey,
    );
    if (cachedStructureShadowV2) {
      structureShadowV2CacheEntry = cachedStructureShadowV2;
      structureShadowCacheHit = true;
    } else {
      const rebuiltStructureShadowV2 = buildStructureShadowV2CacheEntry({
        overlay,
        triangleCache,
        geometrySignature,
        tileWorld: input.tileWorld,
        toScreenAtZ: input.toScreenAtZ,
        sunForward: frame.sunModel.forward,
        sunProjectionDirection: frame.sunModel.projectionDirection,
        sunStepKey: frame.sunModel.stepKey,
        drawDx: input.draw.dx,
        drawDy: input.draw.dy,
        drawScale: input.draw.scale ?? 1,
        sourceImage: input.sourceImage,
        roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
        alphaThreshold: STRUCTURE_SHADOW_V2_ALPHA_THRESHOLD,
        silhouetteSampleStep: STRUCTURE_SHADOW_V2_SILHOUETTE_SAMPLE_STEP,
        maxLoopPoints: STRUCTURE_SHADOW_V2_MAX_LOOP_POINTS,
      });
      structureShadowV2CacheEntry = rebuiltStructureShadowV2;
      input.cacheStores.v2.set(rebuiltStructureShadowV2);
      structureShadowCacheHit = false;
    }
    projectedStructureShadowTriangles = structureShadowV2CacheEntry.shadowTriangles;
    projectedStructureShadowBounds = structureShadowV2CacheEntry.projectedBounds;
  } else {
    const cachedStructureShadow = input.cacheStores.v1.get(
      overlay.id,
      geometrySignature,
      frame.sunModel.stepKey,
    );
    if (cachedStructureShadow) {
      structureShadowV1CacheEntry = cachedStructureShadow;
      structureShadowCacheHit = true;
    } else {
      const rebuiltStructureShadow = buildStructureShadowCacheEntry({
        overlay,
        triangleCache,
        geometrySignature,
        tileWorld: input.tileWorld,
        toScreenAtZ: input.toScreenAtZ,
        sunForward: frame.sunModel.forward,
        sunProjectionDirection: frame.sunModel.projectionDirection,
        sunStepKey: frame.sunModel.stepKey,
        roofScanStepPx: STRUCTURE_SHADOW_V1_ROOF_SCAN_STEP_PX,
      });
      structureShadowV1CacheEntry = rebuiltStructureShadow;
      input.cacheStores.v1.set(rebuiltStructureShadow);
      structureShadowCacheHit = false;
    }
    projectedStructureShadowTriangles = structureShadowV1CacheEntry.shadowTriangles;
    projectedStructureShadowBounds = structureShadowV1CacheEntry.projectedBounds;
  }

  const projectedVisible = projectedStructureShadowBounds
    ? input.projectedRectIntersects(projectedStructureShadowBounds, input.projectedViewportRect)
    : false;

  const v5Triangles: StructureV5ShadowMaskTriangle[] = [];
  const v6Triangles: StructureV5ShadowMaskTriangle[] = [];
  if (
    (frame.routing.usesV5 || frame.routing.usesV6)
    && structureShadowHybridCacheEntry
    && input.admittedTrianglesForSemanticMasks.length > 0
  ) {
    const semanticByStableId = buildHybridTriangleSemanticMap({
      overlay,
      triangleCache,
      activeRoofQuad: structureShadowHybridCacheEntry.roofScan.activeLevel?.quad ?? null,
      triangles: input.admittedTrianglesForSemanticMasks,
    });
    for (let ti = 0; ti < input.admittedTrianglesForSemanticMasks.length; ti++) {
      const tri = input.admittedTrianglesForSemanticMasks[ti];
      const semantic = semanticByStableId.get(tri.stableId) ?? "UNCLASSIFIED";
      const buckets = resolveHybridSemanticMaskBuckets(semantic);
      for (let bi = 0; bi < buckets.length; bi++) {
        const bucket = buckets[bi];
        if (
          frame.routing.usesV6
          && bucket !== input.v6PrimarySemanticBucket
          && bucket !== input.v6SecondarySemanticBucket
          && bucket !== input.v6TopSemanticBucket
        ) {
          continue;
        }
        const triEntry: StructureV5ShadowMaskTriangle = {
          stableId: tri.stableId,
          semanticBucket: bucket,
          srcTriangle: [tri.srcPoints[0], tri.srcPoints[1], tri.srcPoints[2]],
          dstTriangle: [tri.points[0], tri.points[1], tri.points[2]],
        };
        if (frame.routing.usesV5) v5Triangles.push(triEntry);
        if (frame.routing.usesV6) v6Triangles.push(triEntry);
      }
    }
  }

  let v5MaskAnchor = {
    x: input.draw.dx + input.draw.dw * 0.5,
    y: input.draw.dy + input.draw.dh,
  };
  if (input.admittedTrianglesForSemanticMasks.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let ti = 0; ti < input.admittedTrianglesForSemanticMasks.length; ti++) {
      const tri = input.admittedTrianglesForSemanticMasks[ti];
      for (let vi = 0; vi < tri.points.length; vi++) {
        const p = tri.points[vi];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
      v5MaskAnchor = {
        x: (minX + maxX) * 0.5,
        y: maxY,
      };
    }
  }

  const v5BuildingAnchor = {
    x: input.draw.dx + input.draw.dw * 0.5,
    y: input.draw.dy + input.draw.dh,
  };

  const shouldQueueProjectedShadow = projectedVisible && !frame.routing.usesV5 && !frame.routing.usesV6;
  const shouldQueueV5Shadow = frame.routing.usesV5 && v5Triangles.length > 0;

  let projectedTriangles: readonly StructureShadowProjectedTriangle[] | null = null;
  let hybridPiece = null as StructureShadowOverlayQueueResult["hybridPiece"];
  let v4Piece = null as StructureShadowOverlayQueueResult["v4Piece"];
  let v5Piece = null as StructureShadowOverlayQueueResult["v5Piece"];

  if (shouldQueueProjectedShadow || shouldQueueV5Shadow) {
    if (shouldQueueV5Shadow) {
      v5Piece = {
        structureInstanceId: overlay.id,
        sourceImage: input.sourceImage,
        sourceImageWidth: Math.max(1, Math.round(input.draw.dw)),
        sourceImageHeight: Math.max(1, Math.round(input.draw.dh)),
        triangles: v5Triangles,
        buildingDrawOrigin: { x: input.draw.dx, y: input.draw.dy },
        buildingAnchor: v5BuildingAnchor,
        maskAnchor: v5MaskAnchor,
      };
    } else if (
      frame.routing.usesV4
      && structureShadowV4CacheEntry
      && (
        structureShadowV4CacheEntry.triangleCorrespondence.length > 0
        || structureShadowV4CacheEntry.topCapTriangles.length > 0
      )
    ) {
      v4Piece = {
        sourceImage: input.sourceImage,
        sourceImageWidth: Math.max(1, Math.round(input.draw.dw)),
        sourceImageHeight: Math.max(1, Math.round(input.draw.dh)),
        topCapTriangles: structureShadowV4CacheEntry.topCapTriangles,
        triangleCorrespondence: structureShadowV4CacheEntry.triangleCorrespondence,
      };
    } else if (frame.routing.usesHybrid && hybridProjectedMappings.length > 0) {
      hybridPiece = {
        sourceImage: input.sourceImage,
        sourceImageWidth: Math.max(1, Math.round(input.draw.dw)),
        sourceImageHeight: Math.max(1, Math.round(input.draw.dh)),
        projectedMappings: hybridProjectedMappings,
      };
    } else if (!frame.routing.usesV4 && projectedStructureShadowTriangles.length > 0) {
      projectedTriangles = projectedStructureShadowTriangles;
    }
  }

  const v6Candidate: StructureV6ShadowDebugCandidate | null = frame.routing.usesV6 && v6Triangles.length > 0
    ? {
        structureInstanceId: overlay.id,
        sourceImage: input.sourceImage,
        sourceImageWidth: Math.max(1, Math.round(input.draw.dw)),
        sourceImageHeight: Math.max(1, Math.round(input.draw.dh)),
        triangles: v6Triangles,
        zBand: input.structureShadowBand,
      }
    : null;

  return {
    structureShadowBand: input.structureShadowBand,
    projectedTriangles,
    projectedVisible,
    hybridPiece,
    v4Piece,
    v5Piece,
    v6Candidate,
    structureShadowV1CacheEntry,
    structureShadowV2CacheEntry,
    structureShadowHybridCacheEntry,
    structureShadowV4CacheEntry,
    structureShadowCacheHit,
  };
}

export type BuildStructureV6VerticalShadowFrameResultInput<TVerticalDebugData> = {
  frame: StructureShadowFrameResult;
  candidates: readonly StructureV6ShadowDebugCandidate[];
  primarySemanticBucket: ShadowV6SemanticBucket;
  requestedSemanticBucket: ShadowV6SemanticBucket;
  requestedStructureIndex: number;
  requestedSliceCount: number;
  shadowLengthPx: number;
  countCandidateTrianglesForBucket: (
    candidate: StructureV6ShadowDebugCandidate,
    bucket: ShadowV6SemanticBucket,
  ) => number;
  resolveSelectedCandidateIndex: (candidateCount: number, requestedIndex: number) => number;
  buildVerticalDebugData: (
    candidate: StructureV6ShadowDebugCandidate,
    requestedSemanticBucket: ShadowV6SemanticBucket,
    requestedStructureIndex: number,
    selectedStructureIndex: number,
    candidateCount: number,
    requestedSliceCount: number,
    shadowVector: { x: number; y: number },
  ) => TVerticalDebugData | null;
};

export function buildStructureV6VerticalShadowFrameResult<TVerticalDebugData>(
  input: BuildStructureV6VerticalShadowFrameResultInput<TVerticalDebugData>,
): TVerticalDebugData | null {
  if (!input.frame.routing.usesV6 || input.candidates.length <= 0) return null;

  const shadowVector = {
    x: input.frame.sunModel.projectionDirection.x * input.shadowLengthPx,
    y: input.frame.sunModel.projectionDirection.y * input.shadowLengthPx,
  };

  const candidatesWithPrimaryBucket = input.candidates.filter(
    (candidate) => input.countCandidateTrianglesForBucket(candidate, input.primarySemanticBucket) > 0,
  );
  const candidatePool = candidatesWithPrimaryBucket.length > 0
    ? candidatesWithPrimaryBucket
    : input.candidates;

  const orderedCandidates = candidatePool
    .slice()
    .sort((a, b) => {
      const byId = a.structureInstanceId.localeCompare(b.structureInstanceId);
      if (byId !== 0) return byId;
      return (
        input.countCandidateTrianglesForBucket(b, input.primarySemanticBucket)
        - input.countCandidateTrianglesForBucket(a, input.primarySemanticBucket)
      );
    });

  const selectedStructureIndex = input.resolveSelectedCandidateIndex(
    orderedCandidates.length,
    input.requestedStructureIndex,
  );
  const selected = selectedStructureIndex >= 0 ? orderedCandidates[selectedStructureIndex] : null;
  if (!selected) return null;

  return input.buildVerticalDebugData(
    selected,
    input.requestedSemanticBucket,
    input.requestedStructureIndex,
    selectedStructureIndex,
    orderedCandidates.length,
    input.requestedSliceCount,
    shadowVector,
  );
}
