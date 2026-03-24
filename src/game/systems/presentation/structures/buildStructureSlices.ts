import type { ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import {
  rectIntersects as runtimeStructureRectIntersects,
  runtimeStructureTriangleGeometrySignatureForOverlay,
  buildMonolithicStructureTriangleCacheForOverlay,
  getMonolithicGeometryFromCache,
  resolveMonolithicFootprintTileBoundsForOverlay,
  type RuntimeStructureTrianglePiece,
  type RuntimeStructureTriangleRect,
  type RuntimeStructureTriangleCacheStore,
  type MonolithicStructureGeometry,
  type RuntimeStructureAnchorPlacementDebug,
} from "../../../structures/monolithicStructureGeometry";
import {
  buildStructureShadowFrameResult as buildOrchestratedStructureShadowFrameResult,
} from "../structureShadows/structureShadowOrchestrator";
import type {
  StructureShadowFrameResult,
} from "../structureShadows/structureShadowTypes";
import type {
  StructureShadowCacheEntry,
  StructureShadowCacheStore,
} from "../structureShadowV1";
import type {
  StructureShadowV2CacheEntry,
  StructureShadowV2CacheStore,
} from "../structureShadowV2AlphaSilhouette";
import {
  buildHybridTriangleSemanticMap,
  type HybridSemanticClass,
  type StructureShadowHybridCacheEntry,
  type StructureShadowHybridCacheStore,
} from "../structureShadowHybridTriangles";
import type {
  StructureShadowV4CacheEntry,
  StructureShadowV4CacheStore,
} from "../structureShadowV4";
import type { StaticRelightFrameContext } from "../staticRelight/staticRelightTypes";
import {
  isCameraTileInsideBounds,
  isTriangleVisibleForAdmissionMode,
} from "./structureOverlayAdmission";
import type {
  HybridShadowDiagnosticStats,
  StructureAdmissionMode,
  StructureOverlayCandidate,
  StructureShadowQueueCallbacks,
  StructureSliceBuildResult,
  StructureSlicePiece,
  StructureTileBounds,
  V4ShadowDiagnosticStats,
  V5ShadowDiagnosticStats,
} from "./structurePresentationTypes";

type ScreenPt = { x: number; y: number };
type ScreenRect = { minX: number; maxX: number; minY: number; maxY: number };
type LocalRect = { minX: number; maxX: number; minY: number; maxY: number };
type ProjectedQuad = [ScreenPt, ScreenPt, ScreenPt, ScreenPt];
type FootprintSupportCell = {
  col: number;
  row: number;
  quad: ProjectedQuad;
  supported: boolean;
};
type FootprintSupportLevel = {
  level: number;
  liftYPx: number;
  quad: ProjectedQuad;
  cells: FootprintSupportCell[];
  supportedCells: number;
  totalCells: number;
  anySupport: boolean;
  allSupported: boolean;
};

const STRUCTURE_FOOTPRINT_SCAN_STEP_PX = 64;

type BuildStructureSlicesInput = {
  ctx: CanvasRenderingContext2D;
  candidates: readonly StructureOverlayCandidate[];
  tileWorld: number;
  projectedViewportRect: RuntimeStructureTriangleRect;
  strictViewportTileBounds: StructureTileBounds;
  structureTriangleAdmissionMode: StructureAdmissionMode;
  structureTriangleCutoutEnabled: boolean;
  structureTriangleCutoutHalfWidth: number;
  structureTriangleCutoutHalfHeight: number;
  structureTriangleCutoutAlpha: number;
  structureCutoutScreenRect: ScreenRect;
  isPointInsideStructureCutoutScreenRect: (x: number, y: number) => boolean;
  playerCameraTx: number;
  playerCameraTy: number;
  isTileInRenderRadius: (tx: number, ty: number) => boolean;
  isParentTileAfterPlayer: (parentTx: number, parentTy: number) => boolean;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
  rampRoadTiles: ReadonlySet<string>;
  resolveRenderZBand: (
    key: {
      slice: number;
      within: number;
      baseZ: number;
    },
    rampRoadTiles: ReadonlySet<string>,
  ) => number;
  structureShadowFrame: StructureShadowFrameResult;
  v6PrimarySemanticBucket: ShadowV6SemanticBucket;
  v6SecondarySemanticBucket: ShadowV6SemanticBucket;
  v6TopSemanticBucket: ShadowV6SemanticBucket;
  monolithicStructureGeometryCacheStore: RuntimeStructureTriangleCacheStore;
  getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
  showStructureSliceDebug: boolean;
  showStructureTriangleFootprintDebug: boolean;
  showStructureAnchors: boolean;
  showStructureTriangleOwnershipSortDebug: boolean;
  shadowV1DebugGeometryMode: string;
  deferredStructureSliceDebugDraws: Array<() => void>;
  didQueueStructureCutoutDebugRect: boolean;
  logStructureOwnershipDebug: boolean;
  loggedStructureOwnershipDebugIds: Set<string>;
  shadowQueueCallbacks: StructureShadowQueueCallbacks;
  shadowDiagnostics: {
    hybrid: HybridShadowDiagnosticStats;
    v4: V4ShadowDiagnosticStats;
    v5: V5ShadowDiagnosticStats;
  };
  staticRelightFrame: StaticRelightFrameContext | null;
  structureShadowV1CacheStore: StructureShadowCacheStore;
  structureShadowV2CacheStore: StructureShadowV2CacheStore;
  structureShadowHybridCacheStore: StructureShadowHybridCacheStore;
  structureShadowV4CacheStore: StructureShadowV4CacheStore;
};

export function buildStructureSlices(input: BuildStructureSlicesInput): StructureSliceBuildResult {
  const pieces: StructureSlicePiece[] = [];
  let didQueueStructureCutoutDebugRect = input.didQueueStructureCutoutDebugRect;

  for (let i = 0; i < input.candidates.length; i++) {
    const candidate = input.candidates[i];
    const o = candidate.overlay;
    const draw = candidate.draw;
    const structureSouthTieBreak = candidate.structureSouthTieBreak;

    if (candidate.useRuntimeStructureSlicing && draw.img) {
      const projectedDraw = {
        dx: draw.dx,
        dy: draw.dy,
        dw: draw.dw,
        dh: draw.dh,
        flipX: !!draw.flipX,
        scale: draw.scale ?? 1,
      };
      const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(o, projectedDraw);
      let triangleCache = input.monolithicStructureGeometryCacheStore.get(o.id, geometrySignature);
      if (!triangleCache) {
        const built = buildMonolithicStructureTriangleCacheForOverlay({
          overlay: o,
          image: draw.img,
          draw: projectedDraw,
          getFlippedOverlayImage: input.getFlippedOverlayImage,
        });
        if (built.cache) {
          input.monolithicStructureGeometryCacheStore.set(built.cache);
          triangleCache = built.cache;
        } else {
          input.monolithicStructureGeometryCacheStore.markFallback(o.id);
        }
      }
      if (!triangleCache) continue;

      const sourceImg: CanvasImageSource = draw.flipX ? input.getFlippedOverlayImage(draw.img) : draw.img;
      const monolithic = getMonolithicGeometryFromCache(triangleCache);

      if (input.logStructureOwnershipDebug && !input.loggedStructureOwnershipDebugIds.has(o.id)) {
        input.loggedStructureOwnershipDebugIds.add(o.id);
        const owners = triangleCache.parentTileGroups.map((group) => ({
          tx: group.parentTx,
          ty: group.parentTy,
          feetSortY: group.feetSortY,
        }));
        console.log("[structure-ownership]", {
          structureId: o.id,
          flipped: !!o.flipX,
          w: monolithic?.n ?? Math.max(1, o.w | 0),
          h: monolithic?.m ?? Math.max(1, o.h | 0),
          anchorTx: o.seTx,
          anchorTy: o.seTy,
          first3: owners.slice(0, 3),
          last3: owners.slice(Math.max(0, owners.length - 3)),
        });
      }

      const usingV5Caster = input.structureShadowFrame.routing.usesV5;
      const usingV6Caster = input.structureShadowFrame.routing.usesV6;
      const admittedTrianglesForSemanticMasks: typeof triangleCache.triangles = [];
      const finalVisibleTrianglesForDebug: RuntimeStructureTrianglePiece[] = [];
      const visibleTriangleGroupsForDebug: Array<{
        stableId: number;
        parentTx: number;
        parentTy: number;
        feetSortY: number;
        visibleTriangles: RuntimeStructureTrianglePiece[];
      }> = [];
      const buildingDirectionalRejected = o.seTx < input.playerCameraTx || o.seTy < input.playerCameraTy;
      const buildingDirectionalEligible = !buildingDirectionalRejected;
      let overlayHasVisibleTriangleGroup = false;

      if (input.showStructureTriangleFootprintDebug && input.structureTriangleCutoutEnabled && !didQueueStructureCutoutDebugRect) {
        didQueueStructureCutoutDebugRect = true;
        input.deferredStructureSliceDebugDraws.push(() => {
          input.ctx.save();
          const x = input.structureCutoutScreenRect.minX;
          const y = input.structureCutoutScreenRect.minY;
          const wRect = input.structureCutoutScreenRect.maxX - input.structureCutoutScreenRect.minX;
          const hRect = input.structureCutoutScreenRect.maxY - input.structureCutoutScreenRect.minY;
          input.ctx.fillStyle = "rgba(120,40,255,0.08)";
          input.ctx.strokeStyle = "rgba(160,90,255,0.8)";
          input.ctx.lineWidth = 1;
          input.ctx.fillRect(x, y, wRect, hRect);
          input.ctx.strokeRect(x, y, wRect, hRect);
          input.ctx.restore();
        });
      }

      for (let gi = 0; gi < triangleCache.parentTileGroups.length; gi++) {
        const group = triangleCache.parentTileGroups[gi];
        const groupParentAfterPlayer = input.isParentTileAfterPlayer(group.parentTx, group.parentTy);
        const finalVisibleTriangles = [] as typeof group.triangles;
        const compareDistanceOnlyTriangles = [] as typeof group.triangles;

        for (let ti = 0; ti < group.triangles.length; ti++) {
          const tri = group.triangles[ti];
          const viewportVisible = isCameraTileInsideBounds(
            tri.admissionTx,
            tri.admissionTy,
            input.strictViewportTileBounds,
          );
          const renderDistanceVisible = input.isTileInRenderRadius(tri.admissionTx, tri.admissionTy);
          const finalVisible = isTriangleVisibleForAdmissionMode(
            input.structureTriangleAdmissionMode,
            viewportVisible,
            renderDistanceVisible,
          );
          if (!finalVisible) continue;
          finalVisibleTriangles.push(tri);
          if (input.structureTriangleAdmissionMode === "compare" && renderDistanceVisible && !viewportVisible) {
            compareDistanceOnlyTriangles.push(tri);
          }
        }

        if (!finalVisibleTriangles.length) continue;
        if (usingV5Caster || usingV6Caster) admittedTrianglesForSemanticMasks.push(...finalVisibleTriangles);
        finalVisibleTrianglesForDebug.push(...finalVisibleTriangles);
        visibleTriangleGroupsForDebug.push({
          stableId: group.stableId,
          parentTx: group.parentTx,
          parentTy: group.parentTy,
          feetSortY: group.feetSortY,
          visibleTriangles: [...finalVisibleTriangles],
        });
        overlayHasVisibleTriangleGroup = true;

        pieces.push({
          kind: "triangleGroup",
          overlay: o,
          draw,
          sourceImage: sourceImg,
          geometrySignature,
          triangleCache,
          parentTx: group.parentTx,
          parentTy: group.parentTy,
          feetSortY: group.feetSortY,
          stableId: group.stableId,
          finalVisibleTriangles,
          compareDistanceOnlyTriangles,
          structureSouthTieBreak,
          cutoutEnabled: input.structureTriangleCutoutEnabled,
          cutoutAlpha: input.structureTriangleCutoutAlpha,
          buildingDirectionalEligible,
          groupParentAfterPlayer,
          isPointInsideStructureCutoutScreenRect: input.isPointInsideStructureCutoutScreenRect,
        });
      }

      if (!overlayHasVisibleTriangleGroup) continue;

      const structureShadowBand = input.resolveRenderZBand(
        {
          slice: o.seTx + o.seTy,
          within: o.seTx,
          baseZ: o.z,
        },
        input.rampRoadTiles,
      );
      const structureShadowResult = buildOrchestratedStructureShadowFrameResult({
        frame: input.structureShadowFrame,
        overlay: o,
        triangleCache,
        geometrySignature,
        tileWorld: input.tileWorld,
        toScreenAtZ: input.toScreenAtZ,
        draw: {
          dx: draw.dx,
          dy: draw.dy,
          dw: draw.dw,
          dh: draw.dh,
          scale: draw.scale ?? 1,
        },
        sourceImage: sourceImg,
        admittedTrianglesForSemanticMasks,
        projectedViewportRect: input.projectedViewportRect,
        projectedRectIntersects: runtimeStructureRectIntersects,
        structureShadowBand,
        v6PrimarySemanticBucket: input.v6PrimarySemanticBucket,
        v6SecondarySemanticBucket: input.v6SecondarySemanticBucket,
        v6TopSemanticBucket: input.v6TopSemanticBucket,
        cacheStores: {
          v1: input.structureShadowV1CacheStore,
          v2: input.structureShadowV2CacheStore,
          hybrid: input.structureShadowHybridCacheStore,
          v4: input.structureShadowV4CacheStore,
        },
        diagnostics: {
          hybrid: input.shadowDiagnostics.hybrid,
          v4: input.shadowDiagnostics.v4,
        },
      });

      if (structureShadowResult.v6Candidate) {
        input.shadowQueueCallbacks.structureV6ShadowDebugCandidates.push(structureShadowResult.v6Candidate);
      }
      if (structureShadowResult.v5Piece) {
        input.shadowQueueCallbacks.queueStructureV5ShadowForBand(structureShadowBand, structureShadowResult.v5Piece);
        input.shadowDiagnostics.v5.piecesQueued += 1;
        input.shadowDiagnostics.v5.trianglesQueued += structureShadowResult.v5Piece.triangles.length;
      } else if (structureShadowResult.v4Piece) {
        input.shadowQueueCallbacks.queueStructureV4ShadowForBand(structureShadowBand, structureShadowResult.v4Piece);
        input.shadowDiagnostics.v4.piecesQueued += 1;
        input.shadowDiagnostics.v4.trianglesQueued += structureShadowResult.v4Piece.triangleCorrespondence.length;
        input.shadowDiagnostics.v4.topCapTrianglesQueued += structureShadowResult.v4Piece.topCapTriangles.length;
      } else if (structureShadowResult.hybridPiece) {
        input.shadowQueueCallbacks.queueStructureHybridShadowForBand(structureShadowBand, structureShadowResult.hybridPiece);
        input.shadowDiagnostics.hybrid.piecesQueued += 1;
        input.shadowDiagnostics.hybrid.trianglesQueued += structureShadowResult.hybridPiece.projectedMappings.length;
      } else if (structureShadowResult.projectedTriangles) {
        input.shadowQueueCallbacks.queueStructureShadowTrianglesForBand(
          structureShadowBand,
          structureShadowResult.projectedTriangles,
        );
      }

      if (
        monolithic
        && (
          input.showStructureAnchors
          || input.showStructureSliceDebug
          || input.showStructureTriangleFootprintDebug
          || input.showStructureTriangleOwnershipSortDebug
        )
      ) {
        const activeRoofQuad = activeRoofQuadForSemanticDebug({
          structureShadowV1CacheEntry: structureShadowResult.structureShadowV1CacheEntry,
          structureShadowV2CacheEntry: structureShadowResult.structureShadowV2CacheEntry,
          structureShadowHybridCacheEntry: structureShadowResult.structureShadowHybridCacheEntry,
        });
        const semanticByStableId = input.showStructureTriangleFootprintDebug
          ? buildHybridTriangleSemanticMap({
            overlay: o,
            triangleCache,
            activeRoofQuad,
            triangles: finalVisibleTrianglesForDebug,
          })
          : null;
        const semanticFaceTriangles = finalVisibleTrianglesForDebug.map((tri) => ({
          points: [tri.points[0], tri.points[1], tri.points[2]] as [ScreenPt, ScreenPt, ScreenPt],
          semantic: semanticByStableId?.get(tri.stableId) ?? "UNCLASSIFIED",
        }));
        queueMonolithicStructureDebugDraw({
          ctx: input.ctx,
          deferredStructureSliceDebugDraws: input.deferredStructureSliceDebugDraws,
          overlayId: o.id,
          overlaySpriteId: o.spriteId,
          draw,
          geometry: monolithic,
          showAnchors: input.showStructureAnchors,
          showSlices: input.showStructureSliceDebug,
          showSemanticFaces: input.showStructureTriangleFootprintDebug,
          semanticFaceTriangles,
        });
        queueMonolithicTriangleOwnershipSortDebugDraw({
          ctx: input.ctx,
          deferredStructureSliceDebugDraws: input.deferredStructureSliceDebugDraws,
          enabled: input.showStructureTriangleOwnershipSortDebug,
          overlayBaseZ: o.z,
          visibleGroups: visibleTriangleGroupsForDebug,
          tileWorld: input.tileWorld,
          toScreenAtZ: input.toScreenAtZ,
        });
      }
      continue;
    }

    {
      pieces.push({
        kind: "overlay",
        overlayIndex: candidate.overlayIndex,
        overlay: o,
        draw,
      });
    }
  }

  return {
    pieces,
    didQueueStructureCutoutDebugRect,
  };
}

type QueueMonolithicStructureDebugDrawInput = {
  ctx: CanvasRenderingContext2D;
  deferredStructureSliceDebugDraws: Array<() => void>;
  overlayId: string;
  overlaySpriteId: string;
  draw: {
    dx: number;
    dy: number;
    dw: number;
    dh: number;
    scale?: number;
    anchorPlacementDebugNoCamera?: RuntimeStructureAnchorPlacementDebug;
  };
  geometry: MonolithicStructureGeometry;
  showAnchors: boolean;
  showSlices: boolean;
  showSemanticFaces: boolean;
  semanticFaceTriangles: ReadonlyArray<{
    points: [ScreenPt, ScreenPt, ScreenPt];
    semantic: HybridSemanticClass;
  }>;
};

type QueueMonolithicTriangleOwnershipSortDebugDrawInput = {
  ctx: CanvasRenderingContext2D;
  deferredStructureSliceDebugDraws: Array<() => void>;
  enabled: boolean;
  overlayBaseZ: number;
  visibleGroups: ReadonlyArray<{
    stableId: number;
    parentTx: number;
    parentTy: number;
    feetSortY: number;
    visibleTriangles: readonly RuntimeStructureTrianglePiece[];
  }>;
  tileWorld: number;
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt;
};

function drawCrossMarker(
  ctx: CanvasRenderingContext2D,
  pt: ScreenPt,
  radius: number,
  strokeStyle: string,
): void {
  ctx.beginPath();
  ctx.moveTo(pt.x - radius, pt.y);
  ctx.lineTo(pt.x + radius, pt.y);
  ctx.moveTo(pt.x, pt.y - radius);
  ctx.lineTo(pt.x, pt.y + radius);
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

function ownerTileMarkerQuad(
  tx: number,
  ty: number,
  z: number,
  tileWorld: number,
  toScreenAtZ: QueueMonolithicTriangleOwnershipSortDebugDrawInput["toScreenAtZ"],
): ProjectedQuad {
  return [
    toScreenAtZ(tx * tileWorld, ty * tileWorld, z),
    toScreenAtZ((tx + 1) * tileWorld, ty * tileWorld, z),
    toScreenAtZ((tx + 1) * tileWorld, (ty + 1) * tileWorld, z),
    toScreenAtZ(tx * tileWorld, (ty + 1) * tileWorld, z),
  ];
}

function queueMonolithicTriangleOwnershipSortDebugDraw(
  input: QueueMonolithicTriangleOwnershipSortDebugDrawInput,
): void {
  if (!input.enabled || input.visibleGroups.length <= 0) return;

  input.deferredStructureSliceDebugDraws.push(() => {
    const { ctx } = input;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.font = "5px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";

    for (let gi = 0; gi < input.visibleGroups.length; gi++) {
      const group = input.visibleGroups[gi];
      const ownerQuad = ownerTileMarkerQuad(
        group.parentTx,
        group.parentTy,
        input.overlayBaseZ,
        input.tileWorld,
        input.toScreenAtZ,
      );
      const ownerCenter = {
        x: (ownerQuad[0].x + ownerQuad[1].x + ownerQuad[2].x + ownerQuad[3].x) * 0.25,
        y: (ownerQuad[0].y + ownerQuad[1].y + ownerQuad[2].y + ownerQuad[3].y) * 0.25,
      };

      ctx.beginPath();
      ctx.moveTo(ownerQuad[0].x, ownerQuad[0].y);
      for (let qi = 1; qi < ownerQuad.length; qi++) ctx.lineTo(ownerQuad[qi].x, ownerQuad[qi].y);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 240, 110, 0.55)";
      ctx.stroke();
      drawCrossMarker(ctx, ownerCenter, 4, "rgba(255, 240, 110, 0.92)");

      for (let ti = 0; ti < group.visibleTriangles.length; ti++) {
        const tri = group.visibleTriangles[ti];
        const [a, b, c] = tri.points;
        const centroid = {
          x: (a.x + b.x + c.x) / 3,
          y: (a.y + b.y + c.y) / 3,
        };
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(55, 200, 255, 0.10)";
        ctx.strokeStyle = "rgba(55, 200, 255, 0.92)";
        ctx.fill();
        ctx.stroke();
        const triLabel = `P(${tri.parentTx},${tri.parentTy}) T(${tri.triangleTx},${tri.triangleTy})`;
        ctx.fillStyle = "rgba(0,0,0,0.88)";
        ctx.fillText(triLabel, centroid.x + 1, centroid.y - 7);
        ctx.fillStyle = "rgba(230, 245, 255, 0.98)";
        ctx.fillText(triLabel, centroid.x, centroid.y - 8);
      }
    }

    ctx.restore();
  });
}

function semanticFaceStyle(semantic: HybridSemanticClass): { fill: string; stroke: string } {
  if (semantic === "TOP") {
    return {
      fill: "rgba(80, 200, 255, 0.36)",
      stroke: "rgba(120, 225, 255, 0.98)",
    };
  }
  if (semantic === "LEFT_SOUTH") {
    return {
      fill: "rgba(95, 255, 150, 0.34)",
      stroke: "rgba(145, 255, 185, 0.98)",
    };
  }
  if (semantic === "RIGHT_EAST") {
    return {
      fill: "rgba(255, 200, 95, 0.34)",
      stroke: "rgba(255, 225, 130, 0.98)",
    };
  }
  if (semantic === "CONFLICT") {
    return {
      fill: "rgba(255, 75, 220, 0.45)",
      stroke: "rgba(255, 130, 235, 1)",
    };
  }
  return {
    fill: "rgba(215, 215, 215, 0.28)",
    stroke: "rgba(245, 245, 245, 0.9)",
  };
}

function activeRoofQuadForSemanticDebug(input: {
  structureShadowV1CacheEntry: StructureShadowCacheEntry | null;
  structureShadowV2CacheEntry: StructureShadowV2CacheEntry | null;
  structureShadowHybridCacheEntry: StructureShadowHybridCacheEntry | null;
}): ProjectedQuad | null {
  const hybrid = input.structureShadowHybridCacheEntry?.roofScan.activeLevel?.quad ?? null;
  if (hybrid) return hybrid;
  const v2 = input.structureShadowV2CacheEntry?.roofScan.activeLevel?.quad ?? null;
  if (v2) return v2;
  const v1 = input.structureShadowV1CacheEntry?.roofScan.activeLevel?.quad ?? null;
  if (v1) return v1;
  return null;
}

function queueMonolithicStructureDebugDraw(input: QueueMonolithicStructureDebugDrawInput): void {
  const scale = input.draw.scale ?? 1;
  const toScreen = (x: number, y: number): ScreenPt => ({
    x: input.draw.dx + x * scale,
    y: input.draw.dy + y * scale,
  });
  const toScreenX = (x: number): number => input.draw.dx + x * scale;
  const toScreenY = (y: number): number => input.draw.dy + y * scale;
  const anchorResult = input.geometry.anchorResult;
  const anchorPt = toScreen(anchorResult.anchorPx.x, anchorResult.anchorPx.y);
  const anchorPlacementDebug = input.draw.anchorPlacementDebugNoCamera ?? null;

  const profilePoints = collectSouthProfilePoints(anchorResult, toScreen);
  const plateauPoints = collectPlateauProfilePoints(anchorResult, toScreen);
  const occupied = input.geometry.occupiedBoundsPx;
  const workRect = input.geometry.workRectSpriteLocal;
  const showAnySlices = input.showSlices || input.showSemanticFaces;

  input.deferredStructureSliceDebugDraws.push(() => {
    const { ctx } = input;
    ctx.save();

    if (input.showAnchors) {
      const bboxX = toScreenX(occupied.minX);
      const bboxY = toScreenY(occupied.minY);
      const bboxW = Math.max(1, (occupied.maxX - occupied.minX + 1) * scale);
      const bboxH = Math.max(1, (occupied.maxY - occupied.minY + 1) * scale);
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(95, 210, 255, 0.10)";
      ctx.strokeStyle = "rgba(95, 210, 255, 0.95)";
      ctx.fillRect(bboxX, bboxY, bboxW, bboxH);
      ctx.strokeRect(bboxX, bboxY, bboxW, bboxH);
      if (profilePoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(profilePoints[0].x, profilePoints[0].y);
        for (let i = 1; i < profilePoints.length; i++) ctx.lineTo(profilePoints[i].x, profilePoints[i].y);
        ctx.strokeStyle = "rgba(140, 180, 255, 0.60)";
        ctx.stroke();
      }
      if (plateauPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(plateauPoints[0].x, plateauPoints[0].y);
        for (let i = 1; i < plateauPoints.length; i++) ctx.lineTo(plateauPoints[i].x, plateauPoints[i].y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 210, 95, 0.98)";
        ctx.stroke();
      }
      const label = `anchor:${input.overlayId}`;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
      ctx.fillText(label, bboxX + 1, bboxY - 6 + 1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.fillText(label, bboxX, bboxY - 6);

      if (anchorPlacementDebug) {
        let computedAnchorScreen = anchorPlacementDebug.computedAnchorScreenNoCamera
          ? { ...anchorPlacementDebug.computedAnchorScreenNoCamera }
          : (anchorPlacementDebug.anchorSpriteLocal
            ? toScreen(anchorPlacementDebug.anchorSpriteLocal.x, anchorPlacementDebug.anchorSpriteLocal.y)
            : null);
        const reservedSeCornerScreen = anchorPlacementDebug.reservedSeCornerScreenNoCamera
          ? { ...anchorPlacementDebug.reservedSeCornerScreenNoCamera }
          : null;
        const derivedWorldCornerScreen = anchorPlacementDebug.anchorDerivedWorldCornerScreenNoCamera
          ? { ...anchorPlacementDebug.anchorDerivedWorldCornerScreenNoCamera }
          : null;
        if (computedAnchorScreen && reservedSeCornerScreen) {
          const camDx = anchorPt.x - computedAnchorScreen.x;
          const camDy = anchorPt.y - computedAnchorScreen.y;
          computedAnchorScreen = {
            x: computedAnchorScreen.x + camDx,
            y: computedAnchorScreen.y + camDy,
          };
          const reservedScreen = {
            x: reservedSeCornerScreen.x + camDx,
            y: reservedSeCornerScreen.y + camDy,
          };
          const derivedScreen = derivedWorldCornerScreen
            ? {
              x: derivedWorldCornerScreen.x + camDx,
              y: derivedWorldCornerScreen.y + camDy,
            }
            : null;
          const alignmentDx = computedAnchorScreen.x - reservedScreen.x;
          const alignmentDy = computedAnchorScreen.y - reservedScreen.y;

          ctx.lineWidth = Math.max(2, Math.min(4, scale * 1.5));
          ctx.strokeStyle = "rgba(255, 90, 170, 0.96)";
          ctx.beginPath();
          ctx.moveTo(reservedScreen.x, reservedScreen.y);
          ctx.lineTo(computedAnchorScreen.x, computedAnchorScreen.y);
          ctx.stroke();

          const crossR = Math.max(5, Math.min(9, scale * 3));
          ctx.lineWidth = Math.max(2, Math.min(4, scale * 1.8));
          ctx.strokeStyle = "rgba(255, 230, 90, 1)";
          ctx.beginPath();
          ctx.moveTo(reservedScreen.x - crossR, reservedScreen.y);
          ctx.lineTo(reservedScreen.x + crossR, reservedScreen.y);
          ctx.moveTo(reservedScreen.x, reservedScreen.y - crossR);
          ctx.lineTo(reservedScreen.x, reservedScreen.y + crossR);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(computedAnchorScreen.x, computedAnchorScreen.y, Math.max(3, Math.min(7, scale * 2.25)), 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 90, 170, 1)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 90, 170, 0.3)";
          ctx.fill();

          if (derivedScreen) {
            const d = Math.max(5, Math.min(9, scale * 3));
            ctx.lineWidth = Math.max(2, Math.min(4, scale * 1.8));
            ctx.strokeStyle = "rgba(80, 245, 255, 1)";
            ctx.fillStyle = "rgba(80, 245, 255, 0.25)";
            ctx.beginPath();
            ctx.moveTo(derivedScreen.x, derivedScreen.y - d);
            ctx.lineTo(derivedScreen.x + d, derivedScreen.y);
            ctx.lineTo(derivedScreen.x, derivedScreen.y + d);
            ctx.lineTo(derivedScreen.x - d, derivedScreen.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          const alignLabel = `SE Δ(${alignmentDx.toFixed(2)}, ${alignmentDy.toFixed(2)})`;
          const labelX = reservedScreen.x + 10;
          const labelY = reservedScreen.y - 8;
          ctx.font = "10px monospace";
          ctx.fillStyle = "rgba(0,0,0,0.84)";
          ctx.fillText(alignLabel, labelX + 1, labelY + 1);
          ctx.fillStyle = "rgba(255,240,120,0.98)";
          ctx.fillText(alignLabel, labelX, labelY);
          const markerLegend = "A=raw anchor  C=anchor->world corner  SE=footprint corner";
          ctx.fillStyle = "rgba(0,0,0,0.84)";
          ctx.fillText(markerLegend, labelX + 1, labelY + 13);
          ctx.fillStyle = "rgba(220,240,255,0.96)";
          ctx.fillText(markerLegend, labelX, labelY + 12);
        }
      }
    }

    if (showAnySlices) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 120, 70, 0.8)";
      ctx.strokeRect(
        toScreenX(workRect.x),
        toScreenY(workRect.y),
        workRect.w * scale,
        workRect.h * scale,
      );

      for (let si = 0; si < input.geometry.slices.length; si++) {
        const slice = input.geometry.slices[si];
        const sx = workRect.x + slice.x;
        const even = (si % 2) === 0;
        ctx.fillStyle = even ? "rgba(255, 210, 80, 0.20)" : "rgba(100, 245, 155, 0.18)";
        ctx.strokeStyle = even ? "rgba(255, 210, 80, 0.95)" : "rgba(100, 245, 155, 0.92)";
        ctx.fillRect(toScreenX(sx), toScreenY(workRect.y), slice.width * scale, slice.height * scale);
        ctx.strokeRect(toScreenX(sx), toScreenY(workRect.y), slice.width * scale, slice.height * scale);
      }

      for (let si = 0; si < input.geometry.sliceEntries.length; si++) {
        const entry = input.geometry.sliceEntries[si];
        if (input.showSlices) {
          for (let pi = 0; pi < entry.edgePoints.length; pi++) {
            const p = entry.edgePoints[pi];
            ctx.beginPath();
            ctx.arc(toScreenX(p.x), toScreenY(p.y), 1.5, 0, Math.PI * 2);
            ctx.fillStyle = p.side === "R" ? "rgba(255, 240, 120, 0.95)" : "rgba(120, 230, 255, 0.95)";
            ctx.fill();
          }
          if (entry.stripPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(toScreenX(entry.stripPoints[0].x), toScreenY(entry.stripPoints[0].y));
            for (let pi = 1; pi < entry.stripPoints.length; pi++) {
              ctx.lineTo(toScreenX(entry.stripPoints[pi].x), toScreenY(entry.stripPoints[pi].y));
            }
            ctx.strokeStyle = "rgba(255, 120, 70, 0.85)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        if (input.showSlices) {
          for (let ti = 0; ti < entry.culledTriangles.length; ti++) {
            const tri = entry.culledTriangles[ti];
            ctx.beginPath();
            ctx.moveTo(toScreenX(tri.a.x), toScreenY(tri.a.y));
            ctx.lineTo(toScreenX(tri.b.x), toScreenY(tri.b.y));
            ctx.lineTo(toScreenX(tri.c.x), toScreenY(tri.c.y));
            ctx.closePath();
            ctx.fillStyle = "rgba(255, 30, 60, 0.16)";
            ctx.strokeStyle = "rgba(255, 90, 110, 0.96)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);
            ctx.fill();
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        for (let ti = 0; ti < entry.triangles.length; ti++) {
          const tri = entry.triangles[ti];
          ctx.beginPath();
          ctx.moveTo(toScreenX(tri.a.x), toScreenY(tri.a.y));
          ctx.lineTo(toScreenX(tri.b.x), toScreenY(tri.b.y));
          ctx.lineTo(toScreenX(tri.c.x), toScreenY(tri.c.y));
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 80, 150, 0.05)";
          ctx.strokeStyle = "rgba(255, 120, 185, 0.35)";
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
        }
      }

      for (let ti = 0; ti < input.semanticFaceTriangles.length; ti++) {
        const tri = input.semanticFaceTriangles[ti];
        const style = semanticFaceStyle(tri.semantic);
        ctx.beginPath();
        ctx.moveTo(tri.points[0].x, tri.points[0].y);
        ctx.lineTo(tri.points[1].x, tri.points[1].y);
        ctx.lineTo(tri.points[2].x, tri.points[2].y);
        ctx.closePath();
        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }

      if (input.showSlices) {
        for (let ti = 0; ti < input.geometry.footprintCandidatesSpriteLocal.length; ti++) {
          const tri = input.geometry.footprintCandidatesSpriteLocal[ti];
          ctx.beginPath();
          ctx.moveTo(toScreenX(tri.a.x), toScreenY(tri.a.y));
          ctx.lineTo(toScreenX(tri.b.x), toScreenY(tri.b.y));
          ctx.lineTo(toScreenX(tri.c.x), toScreenY(tri.c.y));
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 0, 220, 0.40)";
          ctx.strokeStyle = "rgba(255, 60, 240, 1)";
          ctx.lineWidth = 3;
          ctx.fill();
          ctx.stroke();
        }
        const dimensionLabel = `N:${input.geometry.n}  M:${input.geometry.m}`;
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillText(dimensionLabel, anchorPt.x + 10, anchorPt.y - 14);
        ctx.fillStyle = "rgba(255, 215, 245, 0.98)";
        ctx.fillText(dimensionLabel, anchorPt.x + 9, anchorPt.y - 15);
      }

      if (input.showSemanticFaces) {
        const semanticCounts: Record<HybridSemanticClass, number> = {
          TOP: 0,
          LEFT_SOUTH: 0,
          RIGHT_EAST: 0,
          CONFLICT: 0,
          UNCLASSIFIED: 0,
        };
        for (let i = 0; i < input.semanticFaceTriangles.length; i++) {
          semanticCounts[input.semanticFaceTriangles[i].semantic] += 1;
        }
        const legendRows: Array<{ label: string; semantic: HybridSemanticClass }> = [
          { label: `TOP ${semanticCounts.TOP}`, semantic: "TOP" },
          { label: `LEFT/SOUTH ${semanticCounts.LEFT_SOUTH}`, semantic: "LEFT_SOUTH" },
          { label: `RIGHT/EAST ${semanticCounts.RIGHT_EAST}`, semantic: "RIGHT_EAST" },
          { label: `CONFLICT ${semanticCounts.CONFLICT}`, semantic: "CONFLICT" },
          { label: `UNCLASS ${semanticCounts.UNCLASSIFIED}`, semantic: "UNCLASSIFIED" },
        ];
        const legendX = anchorPt.x + 12;
        const legendY = anchorPt.y - 16;
        ctx.font = "11px monospace";
        for (let ri = 0; ri < legendRows.length; ri++) {
          const row = legendRows[ri];
          const y = legendY + ri * 13;
          const style = semanticFaceStyle(row.semantic);
          ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
          ctx.fillRect(legendX - 2, y - 9, 11, 11);
          ctx.fillStyle = style.fill;
          ctx.fillRect(legendX, y - 7, 7, 7);
          ctx.strokeStyle = style.stroke;
          ctx.lineWidth = 1;
          ctx.strokeRect(legendX, y - 7, 7, 7);
          ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
          ctx.fillText(row.label, legendX + 11, y + 1);
          ctx.fillStyle = "rgba(245, 245, 245, 0.96)";
          ctx.fillText(row.label, legendX + 10, y);
        }
      }
    }

    ctx.beginPath();
    ctx.arc(anchorPt.x, anchorPt.y, Math.max(2, Math.min(6, scale * 2)), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 70, 90, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 240, 245, 0.95)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  });
}

function collectSouthProfilePoints(
  anchorResult: MonolithicStructureGeometry["anchorResult"],
  toScreen: (x: number, y: number) => ScreenPt,
): ScreenPt[] {
  const points: ScreenPt[] = [];
  const bounds = anchorResult.occupiedBoundsPx;
  for (let lx = 0; lx < anchorResult.southYByXLocal.length; lx++) {
    const y = anchorResult.southYByXLocal[lx];
    if (y < 0) continue;
    points.push(toScreen(bounds.minX + lx + 0.5, bounds.minY + y + 0.5));
  }
  return points;
}

function collectPlateauProfilePoints(
  anchorResult: MonolithicStructureGeometry["anchorResult"],
  toScreen: (x: number, y: number) => ScreenPt,
): ScreenPt[] {
  const points: ScreenPt[] = [];
  const bounds = anchorResult.occupiedBoundsPx;
  const startX = Math.max(0, anchorResult.plateauRangeLocal.startX | 0);
  const endX = Math.min(anchorResult.southYByXLocal.length - 1, anchorResult.plateauRangeLocal.endX | 0);
  for (let lx = startX; lx <= endX; lx++) {
    const y = anchorResult.southYByXLocal[lx];
    if (y < 0) continue;
    points.push(toScreen(bounds.minX + lx + 0.5, bounds.minY + y + 0.5));
  }
  return points;
}

function pointInTriangle(
  p: ScreenPt,
  a: ScreenPt,
  b: ScreenPt,
  c: ScreenPt,
): boolean {
  const ab = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const bc = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const ca = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const hasNeg = ab < 0 || bc < 0 || ca < 0;
  const hasPos = ab > 0 || bc > 0 || ca > 0;
  return !(hasNeg && hasPos);
}

function buildProjectedStructureFootprintQuad(
  overlay: {
    seTx: number;
    seTy: number;
    z: number;
    zVisualOffsetUnits?: number;
    layerRole?: "STRUCTURE" | "OVERLAY";
    monolithicSemanticSkinId?: string;
    monolithicSemanticSpriteId?: string;
    w: number;
    h: number;
  },
  tileWorld: number,
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt,
): ProjectedQuad {
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  const bounds = resolveMonolithicFootprintTileBoundsForOverlay(overlay as any);
  const minWorldX = bounds.minTx * tileWorld;
  const minWorldY = bounds.minTy * tileWorld;
  const maxWorldX = (bounds.maxTx + 1) * tileWorld;
  const maxWorldY = (bounds.maxTy + 1) * tileWorld;
  const nw = toScreenAtZ(minWorldX, minWorldY, zVisual);
  const ne = toScreenAtZ(maxWorldX, minWorldY, zVisual);
  const se = toScreenAtZ(maxWorldX, maxWorldY, zVisual);
  const sw = toScreenAtZ(minWorldX, maxWorldY, zVisual);
  return [nw, ne, se, sw];
}

function isPointInsideProjectedStructureFootprintQuad(
  quad: ProjectedQuad,
  x: number,
  y: number,
): boolean {
  const p = { x, y };
  return pointInTriangle(p, quad[0], quad[1], quad[2]) || pointInTriangle(p, quad[0], quad[2], quad[3]);
}

function lerpScreenPt(a: ScreenPt, b: ScreenPt, t: number): ScreenPt {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function sampleProjectedQuadPoint(quad: ProjectedQuad, u: number, v: number): ScreenPt {
  const top = lerpScreenPt(quad[0], quad[1], u);
  const bottom = lerpScreenPt(quad[3], quad[2], u);
  return lerpScreenPt(top, bottom, v);
}

function liftProjectedFootprintQuad(quad: ProjectedQuad, liftYPx: number): ProjectedQuad {
  const liftedY = -liftYPx;
  return [
    { x: quad[0].x, y: quad[0].y + liftedY },
    { x: quad[1].x, y: quad[1].y + liftedY },
    { x: quad[2].x, y: quad[2].y + liftedY },
    { x: quad[3].x, y: quad[3].y + liftedY },
  ];
}

function buildFootprintSupportLevel(
  quad: ProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: ScreenPt[],
  level: number,
  liftYPx: number,
): FootprintSupportLevel {
  const cells: FootprintSupportCell[] = [];
  let supportedCells = 0;
  for (let row = 0; row < rows; row++) {
    const v0 = row / rows;
    const v1 = (row + 1) / rows;
    for (let col = 0; col < cols; col++) {
      const u0 = col / cols;
      const u1 = (col + 1) / cols;
      const cellQuad: ProjectedQuad = [
        sampleProjectedQuadPoint(quad, u0, v0),
        sampleProjectedQuadPoint(quad, u1, v0),
        sampleProjectedQuadPoint(quad, u1, v1),
        sampleProjectedQuadPoint(quad, u0, v1),
      ];
      let supported = false;
      for (let ti = 0; ti < triangleCentroids.length; ti++) {
        const centroid = triangleCentroids[ti];
        if (!isPointInsideProjectedStructureFootprintQuad(cellQuad, centroid.x, centroid.y)) continue;
        supported = true;
        break;
      }
      if (supported) supportedCells++;
      cells.push({
        col,
        row,
        quad: cellQuad,
        supported,
      });
    }
  }
  const totalCells = cols * rows;
  return {
    level,
    liftYPx,
    quad,
    cells,
    supportedCells,
    totalCells,
    anySupport: supportedCells > 0,
    allSupported: supportedCells === totalCells,
  };
}

function scanLiftedFootprintSupportLevels(
  baseQuad: ProjectedQuad,
  cols: number,
  rows: number,
  triangleCentroids: ScreenPt[],
): { levels: FootprintSupportLevel[]; highestValidLevel: number } {
  const levels: FootprintSupportLevel[] = [];
  let highestValidLevel = -1;
  const baseMaxY = Math.max(baseQuad[0].y, baseQuad[1].y, baseQuad[2].y, baseQuad[3].y);
  let minCentroidY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < triangleCentroids.length; i++) {
    minCentroidY = Math.min(minCentroidY, triangleCentroids[i].y);
  }
  const maxLevels = Number.isFinite(minCentroidY)
    ? Math.max(1, Math.ceil((baseMaxY - minCentroidY) / STRUCTURE_FOOTPRINT_SCAN_STEP_PX) + 2)
    : 1;
  for (let level = 0; level < maxLevels; level++) {
    const liftYPx = level * STRUCTURE_FOOTPRINT_SCAN_STEP_PX;
    const liftedQuad = liftProjectedFootprintQuad(baseQuad, liftYPx);
    const levelResult = buildFootprintSupportLevel(
      liftedQuad,
      cols,
      rows,
      triangleCentroids,
      level,
      liftYPx,
    );
    levels.push(levelResult);
    if (levelResult.allSupported) highestValidLevel = level;
    if (!levelResult.allSupported || !levelResult.anySupport) break;
  }
  return { levels, highestValidLevel };
}

type QueueStructureTriangleFootprintShadowDebugDrawsInput = {
  ctx: CanvasRenderingContext2D;
  showStructureTriangleFootprintDebug: boolean;
  deferredStructureSliceDebugDraws: Array<() => void>;
  structureShadowV1CacheEntry: StructureShadowCacheEntry | null;
  structureShadowV2CacheEntry: StructureShadowV2CacheEntry | null;
  structureShadowHybridCacheEntry: StructureShadowHybridCacheEntry | null;
  structureShadowV4CacheEntry: StructureShadowV4CacheEntry | null;
  debugShadowCacheHit: boolean;
  draw: {
    dx: number;
    dy: number;
  };
  shadowV1DebugGeometryMode: string;
};

function queueStructureTriangleFootprintShadowDebugDraws(
  input: QueueStructureTriangleFootprintShadowDebugDrawsInput,
): void {
  if (!input.showStructureTriangleFootprintDebug) return;

  const {
    ctx,
    deferredStructureSliceDebugDraws,
    structureShadowV1CacheEntry,
    structureShadowV2CacheEntry,
    structureShadowHybridCacheEntry,
    structureShadowV4CacheEntry,
    debugShadowCacheHit,
    draw,
    shadowV1DebugGeometryMode,
  } = input;

  if (structureShadowV4CacheEntry) {
    const debugShadowEntry = structureShadowV4CacheEntry;
    deferredStructureSliceDebugDraws.push(() => {
      ctx.save();
      ctx.lineWidth = 1.15;
      ctx.font = "9px monospace";
      const selectedGroup = debugShadowEntry.triangleCorrespondenceGroups[0] ?? null;
      const selectedSliceIndex = selectedGroup?.sliceIndex ?? debugShadowEntry.sliceStrips[0]?.sliceIndex ?? null;
      const selectedBandIndex = selectedGroup?.bandIndex ?? 0;
      const bandPairByKey = new Map<string, (typeof debugShadowEntry.destinationBandTriangles)[number]>();
      for (let pi = 0; pi < debugShadowEntry.destinationBandTriangles.length; pi++) {
        const pair = debugShadowEntry.destinationBandTriangles[pi];
        bandPairByKey.set(`${pair.sliceIndex}:${pair.bandIndex}`, pair);
      }
      for (let ti = 0; ti < debugShadowEntry.topCapTriangles.length; ti++) {
        const [a, b, c] = debugShadowEntry.topCapTriangles[ti];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 175, 70, 0.16)";
        ctx.strokeStyle = "rgba(255, 205, 115, 0.95)";
        ctx.fill();
        ctx.stroke();
      }
      for (let li = 0; li < debugShadowEntry.layerEdges.length; li++) {
        const layerEdge = debugShadowEntry.layerEdges[li];
        const isSelectedSlice = selectedSliceIndex != null && layerEdge.sliceIndex === selectedSliceIndex;
        const midX = (layerEdge.a.x + layerEdge.b.x) * 0.5;
        const midY = (layerEdge.a.y + layerEdge.b.y) * 0.5;
        ctx.beginPath();
        ctx.moveTo(layerEdge.a.x, layerEdge.a.y);
        ctx.lineTo(layerEdge.b.x, layerEdge.b.y);
        ctx.strokeStyle = isSelectedSlice
          ? "rgba(170, 230, 255, 0.75)"
          : "rgba(170, 230, 255, 0.30)";
        ctx.stroke();
        if (isSelectedSlice) {
          ctx.fillStyle = "rgba(200, 235, 255, 0.92)";
          ctx.fillText(`${layerEdge.layerIndex}`, midX + 2, midY - 2);
        }
      }
      for (let bi = 0; bi < debugShadowEntry.layerBands.length; bi++) {
        const band = debugShadowEntry.layerBands[bi];
        const isSelectedSlice = selectedSliceIndex != null && band.sliceIndex === selectedSliceIndex;
        ctx.beginPath();
        ctx.moveTo(band.lowerA.x, band.lowerA.y);
        ctx.lineTo(band.upperA.x, band.upperA.y);
        ctx.moveTo(band.lowerB.x, band.lowerB.y);
        ctx.lineTo(band.upperB.x, band.upperB.y);
        ctx.strokeStyle = isSelectedSlice
          ? "rgba(120, 240, 220, 0.8)"
          : "rgba(120, 240, 220, 0.25)";
        ctx.stroke();
      }
      for (let bi = 0; bi < debugShadowEntry.layerBands.length; bi++) {
        const band = debugShadowEntry.layerBands[bi];
        const pair = bandPairByKey.get(`${band.sliceIndex}:${band.bandIndex}`);
        const isSelectedSlice = selectedSliceIndex != null && band.sliceIndex === selectedSliceIndex;
        const isSelectedBand = isSelectedSlice && band.bandIndex === selectedBandIndex;
        ctx.beginPath();
        ctx.moveTo(band.lowerA.x, band.lowerA.y);
        ctx.lineTo(band.lowerB.x, band.lowerB.y);
        ctx.lineTo(band.upperB.x, band.upperB.y);
        ctx.lineTo(band.upperA.x, band.upperA.y);
        ctx.closePath();
        ctx.strokeStyle = isSelectedBand
          ? "rgba(230, 245, 255, 0.85)"
          : isSelectedSlice
            ? "rgba(205, 215, 255, 0.70)"
            : "rgba(205, 215, 255, 0.20)";
        ctx.stroke();
        if (pair) {
          ctx.beginPath();
          if (pair.diagonal === "A_to_Bprime") {
            ctx.moveTo(band.lowerA.x, band.lowerA.y);
            ctx.lineTo(band.upperB.x, band.upperB.y);
          } else {
            ctx.moveTo(band.lowerB.x, band.lowerB.y);
            ctx.lineTo(band.upperA.x, band.upperA.y);
          }
          ctx.strokeStyle = isSelectedSlice
            ? "rgba(255, 245, 125, 0.92)"
            : "rgba(255, 245, 125, 0.28)";
          ctx.stroke();
        }
        if (isSelectedSlice) {
          const centerX = (band.lowerA.x + band.lowerB.x + band.upperA.x + band.upperB.x) * 0.25;
          const centerY = (band.lowerA.y + band.lowerB.y + band.upperA.y + band.upperB.y) * 0.25;
          ctx.fillStyle = "rgba(225, 235, 255, 0.9)";
          const suffix = isSelectedBand ? "*" : "";
          ctx.fillText(`b${band.bandIndex}${suffix}`, centerX + 2, centerY - 2);
        }
      }
      for (let pi = 0; pi < debugShadowEntry.destinationBandTriangles.length; pi++) {
        const pair = debugShadowEntry.destinationBandTriangles[pi];
        const isSelectedSlice = selectedSliceIndex != null && pair.sliceIndex === selectedSliceIndex;
        const [t0a, t0b, t0c] = pair.tri0;
        const [t1a, t1b, t1c] = pair.tri1;
        ctx.beginPath();
        ctx.moveTo(t0a.x, t0a.y);
        ctx.lineTo(t0b.x, t0b.y);
        ctx.lineTo(t0c.x, t0c.y);
        ctx.closePath();
        ctx.strokeStyle = isSelectedSlice
          ? "rgba(255, 120, 170, 0.85)"
          : "rgba(255, 120, 170, 0.32)";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(t1a.x, t1a.y);
        ctx.lineTo(t1b.x, t1b.y);
        ctx.lineTo(t1c.x, t1c.y);
        ctx.closePath();
        ctx.strokeStyle = isSelectedSlice
          ? "rgba(165, 145, 255, 0.85)"
          : "rgba(165, 145, 255, 0.30)";
        ctx.stroke();
        if (isSelectedSlice) {
          const t0cx = (t0a.x + t0b.x + t0c.x) / 3;
          const t0cy = (t0a.y + t0b.y + t0c.y) / 3;
          const t1cx = (t1a.x + t1b.x + t1c.x) / 3;
          const t1cy = (t1a.y + t1b.y + t1c.y) / 3;
          ctx.fillStyle = "rgba(255, 130, 180, 0.95)";
          ctx.fillText("t0", t0cx + 1, t0cy - 1);
          ctx.fillStyle = "rgba(180, 160, 255, 0.95)";
          ctx.fillText("t1", t1cx + 1, t1cy - 1);
        }
      }
      const triangleCentroid = (
        tri: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
      ) => ({
        x: (tri[0].x + tri[1].x + tri[2].x) / 3,
        y: (tri[0].y + tri[1].y + tri[2].y) / 3,
      });
      for (let gi = 0; gi < debugShadowEntry.triangleCorrespondenceGroups.length; gi++) {
        const group = debugShadowEntry.triangleCorrespondenceGroups[gi];
        const isSelectedGroup = selectedSliceIndex != null
          && group.sliceIndex === selectedSliceIndex
          && group.bandIndex === selectedBandIndex;
        if (!isSelectedGroup) continue;
        for (let si = 0; si < group.sourceTriangles.length; si++) {
          const src = group.sourceTriangles[si];
          const [a, b, c] = src.sourceTrianglePoints;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.strokeStyle = "rgba(255, 150, 70, 0.92)";
          ctx.stroke();
        }
        for (let di = 0; di < group.destinationTriangles.length; di++) {
          const dst = group.destinationTriangles[di];
          const [a, b, c] = dst.destinationTrianglePoints;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.strokeStyle = "rgba(90, 255, 160, 0.92)";
          ctx.stroke();
        }
        for (let ci = 0; ci < group.correspondences.length; ci++) {
          const pair = group.correspondences[ci];
          const srcCentroid = triangleCentroid(pair.sourceTrianglePoints);
          const dstCentroid = triangleCentroid(pair.destinationTrianglePoints);
          const midX = (srcCentroid.x + dstCentroid.x) * 0.5;
          const midY = (srcCentroid.y + dstCentroid.y) * 0.5;
          ctx.beginPath();
          ctx.moveTo(srcCentroid.x, srcCentroid.y);
          ctx.lineTo(dstCentroid.x, dstCentroid.y);
          ctx.strokeStyle = "rgba(255, 225, 85, 0.95)";
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 250, 205, 0.98)";
          ctx.fillText(
            `s${pair.sliceIndex} b${pair.bandIndex} src${pair.sourceTriangleIndexWithinBand}->dst${pair.destinationTriangleIndex}`,
            midX + 2,
            midY - 2,
          );
        }
        if (group.mismatch) {
          const srcAnchor = group.sourceTriangles[0]
            ? triangleCentroid(group.sourceTriangles[0].sourceTrianglePoints)
            : null;
          const dstAnchor = group.destinationTriangles[0]
            ? triangleCentroid(group.destinationTriangles[0].destinationTrianglePoints)
            : null;
          const anchorX = srcAnchor ? srcAnchor.x : (dstAnchor ? dstAnchor.x : draw.dx);
          const anchorY = srcAnchor ? srcAnchor.y : (dstAnchor ? dstAnchor.y : draw.dy);
          ctx.fillStyle = "rgba(255, 90, 90, 0.98)";
          ctx.fillText(
            `MISMATCH s${group.sliceIndex} b${group.bandIndex} src:${group.mismatch.sourceTriangleCount} dst:${group.mismatch.destinationTriangleCount}`,
            anchorX + 4,
            anchorY - 10,
          );
        }
      }
      for (let mi = 0; mi < debugShadowEntry.triangleCorrespondenceMismatches.length; mi++) {
        const mismatch = debugShadowEntry.triangleCorrespondenceMismatches[mi];
        const sourceCandidate = debugShadowEntry.sourceBandTriangles.find(
          (source) => source.sliceIndex === mismatch.sliceIndex && source.bandIndex === mismatch.bandIndex,
        );
        const destinationCandidate = debugShadowEntry.destinationBandEntries.find(
          (destination) => destination.sliceIndex === mismatch.sliceIndex && destination.bandIndex === mismatch.bandIndex,
        );
        const sourceAnchor = sourceCandidate ? triangleCentroid(sourceCandidate.sourceTrianglePoints) : null;
        const destinationAnchor = destinationCandidate ? triangleCentroid(destinationCandidate.destinationTrianglePoints) : null;
        const anchorX = sourceAnchor ? sourceAnchor.x : (destinationAnchor ? destinationAnchor.x : draw.dx);
        const anchorY = sourceAnchor ? sourceAnchor.y : (destinationAnchor ? destinationAnchor.y : draw.dy);
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 70, 70, 0.98)";
        ctx.fill();
      }
      for (let si = 0; si < debugShadowEntry.sliceStrips.length; si++) {
        const strip = debugShadowEntry.sliceStrips[si];
        const baseMidX = (strip.baseA.x + strip.baseB.x) * 0.5;
        const baseMidY = (strip.baseA.y + strip.baseB.y) * 0.5;
        const topMidX = (strip.topA.x + strip.topB.x) * 0.5;
        const topMidY = (strip.topA.y + strip.topB.y) * 0.5;
        ctx.beginPath();
        ctx.moveTo(strip.baseA.x, strip.baseA.y);
        ctx.lineTo(strip.baseB.x, strip.baseB.y);
        ctx.strokeStyle = "rgba(255, 70, 70, 0.96)";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(strip.topA.x, strip.topA.y);
        ctx.lineTo(strip.topB.x, strip.topB.y);
        ctx.strokeStyle = "rgba(70, 255, 120, 0.96)";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(strip.baseA.x, strip.baseA.y);
        ctx.lineTo(strip.topA.x, strip.topA.y);
        ctx.moveTo(strip.baseB.x, strip.baseB.y);
        ctx.lineTo(strip.topB.x, strip.topB.y);
        ctx.strokeStyle = "rgba(80, 225, 255, 0.96)";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(baseMidX, baseMidY);
        ctx.lineTo(topMidX, topMidY);
        ctx.strokeStyle = "rgba(255, 235, 90, 0.98)";
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 245, 190, 0.98)";
        ctx.fillText(`${strip.sliceIndex}`, baseMidX + 2, baseMidY - 2);
      }
      const bounds = debugShadowEntry.projectedBounds;
      const anchor = debugShadowEntry.sliceStrips[0];
      const labelX = bounds
        ? bounds.x + 4
        : anchor
          ? anchor.baseA.x + 4
          : draw.dx + 4;
      const labelY = bounds
        ? bounds.y - 8
        : anchor
          ? anchor.baseA.y - 8
          : draw.dy - 8;
      if (bounds) {
        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
      }
      const ref = debugShadowEntry.deltaReference;
      const deltaLabel = ref
        ? `d(${ref.x.toFixed(1)},${ref.y.toFixed(1)})`
        : "d(none)";
      const focusLabel = selectedSliceIndex != null ? `${selectedSliceIndex}:${selectedBandIndex}` : "none";
      let diagonalACount = 0;
      let diagonalBCount = 0;
      for (let di = 0; di < debugShadowEntry.destinationBandTriangles.length; di++) {
        if (debugShadowEntry.destinationBandTriangles[di].diagonal === "A_to_Bprime") {
          diagonalACount += 1;
        } else {
          diagonalBCount += 1;
        }
      }
      const diagonalLabel = `A:${diagonalACount} B:${diagonalBCount}`;
      const cacheLabel = `shadow:v4 cache:${debugShadowCacheHit ? "hit" : "rebuild"} cap:${debugShadowEntry.topCapTriangles.length} corr:${debugShadowEntry.correspondences.length} strips:${debugShadowEntry.sliceStrips.length} layers:${debugShadowEntry.layerHeightsPx.length} edges:${debugShadowEntry.layerEdges.length} bands:${debugShadowEntry.layerBands.length} triPairs:${debugShadowEntry.destinationBandTriangles.length} tri:${debugShadowEntry.destinationTriangles.length} srcTri:${debugShadowEntry.sourceBandTriangles.length} dstTri:${debugShadowEntry.destinationBandEntries.length} map:${debugShadowEntry.triangleCorrespondence.length} mismatch:${debugShadowEntry.triangleCorrespondenceMismatches.length} diag:${diagonalLabel} focus:${focusLabel} deltaConst:${debugShadowEntry.isDeltaConstant ? "yes" : "no"} ${deltaLabel}`;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
      ctx.fillText(cacheLabel, labelX, labelY);
      ctx.restore();
    });
    return;
  }

  if (structureShadowHybridCacheEntry) {
    const debugShadowEntry = structureShadowHybridCacheEntry;
    deferredStructureSliceDebugDraws.push(() => {
      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
      const roofCorner = activeRoofLevel?.quad?.[0]
        ?? debugShadowEntry.projectedTopCapTriangles[0]?.[0]
        ?? debugShadowEntry.casterTriangles[0]?.[0]
        ?? null;
      const showCapDebug = shadowV1DebugGeometryMode !== "connectorsOnly";
      const showStripDebug = shadowV1DebugGeometryMode !== "capOnly";
      const showSourceDebug = shadowV1DebugGeometryMode !== "capOnly";
      const showRebuiltDebug = shadowV1DebugGeometryMode !== "capOnly";
      ctx.save();
      ctx.lineWidth = 1;
      if (activeRoofLevel) {
        const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
        ctx.beginPath();
        ctx.moveTo(rnw.x, rnw.y);
        ctx.lineTo(rne.x, rne.y);
        ctx.lineTo(rse.x, rse.y);
        ctx.lineTo(rsw.x, rsw.y);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255, 240, 180, 0.92)";
        ctx.stroke();
      }
      if (showSourceDebug) {
        for (let ti = 0; ti < debugShadowEntry.casterTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.casterTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(255, 220, 90, 0.28)";
          ctx.strokeStyle = "rgba(255, 245, 175, 0.96)";
          ctx.fill();
          ctx.stroke();
        }
      }

      if (showCapDebug) {
        for (let ti = 0; ti < debugShadowEntry.projectedTopCapTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.projectedTopCapTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(20, 110, 245, 0.15)";
          ctx.strokeStyle = "rgba(90, 170, 255, 0.95)";
          ctx.fill();
          ctx.stroke();
        }
      }
      if (showStripDebug) {
        ctx.font = "9px monospace";
        for (let si = 0; si < debugShadowEntry.slicePerimeterSegments.length; si++) {
          const segment = debugShadowEntry.slicePerimeterSegments[si];
          const [ba, bb] = segment.baseSegment;
          const [ta, tb] = segment.topSegment;
          const hue = (segment.sliceIndex * 37) % 360;
          const baseMidX = (ba.x + bb.x) * 0.5;
          const baseMidY = (ba.y + bb.y) * 0.5;
          const topMidX = (ta.x + tb.x) * 0.5;
          const topMidY = (ta.y + tb.y) * 0.5;
          ctx.beginPath();
          ctx.moveTo(ba.x, ba.y);
          ctx.lineTo(bb.x, bb.y);
          ctx.strokeStyle = `hsla(${hue}, 92%, 65%, 0.98)`;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ta.x, ta.y);
          ctx.lineTo(tb.x, tb.y);
          ctx.strokeStyle = `hsla(${hue}, 80%, 56%, 0.95)`;
          ctx.stroke();
          ctx.save();
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(baseMidX, baseMidY);
          ctx.lineTo(topMidX, topMidY);
          ctx.strokeStyle = `hsla(${hue}, 75%, 74%, 0.9)`;
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = `hsla(${hue}, 90%, 78%, 0.98)`;
          ctx.fillText(`${segment.sliceIndex}`, baseMidX + 2, baseMidY - 2);
        }
      }
      if (showRebuiltDebug) {
        for (let ti = 0; ti < debugShadowEntry.projectedTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.projectedTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
          ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
          ctx.fill();
          ctx.stroke();
        }
      }
      if (showStripDebug) {
        const sampleBandIndex = debugShadowEntry.slicePerimeterSegments[0]?.bandIndex
          ?? debugShadowEntry.sliceShadowStrips[0]?.bandIndex
          ?? null;
        if (sampleBandIndex != null) {
          for (let mi = 0; mi < debugShadowEntry.projectedMappings.length; mi++) {
            const mapping = debugShadowEntry.projectedMappings[mi];
            if (mapping.bandIndex !== sampleBandIndex) continue;
            const [sa, sb, sc] = mapping.sourceTriangle;
            const [da, db, dc] = mapping.projectedTriangle;
            const sx = (sa.x + sb.x + sc.x) / 3;
            const sy = (sa.y + sb.y + sc.y) / 3;
            const dx = (da.x + db.x + dc.x) / 3;
            const dy = (da.y + db.y + dc.y) / 3;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(dx, dy);
            ctx.strokeStyle = "rgba(255, 110, 240, 0.85)";
            ctx.stroke();
          }
        }
      }
      const shadowBounds = debugShadowEntry.projectedBounds;
      const labelX = shadowBounds
        ? shadowBounds.x + 4
        : roofCorner
          ? roofCorner.x + 4
          : draw.dx + 4;
      const labelY = shadowBounds
        ? shadowBounds.y - 8
        : roofCorner
          ? roofCorner.y - 8
          : draw.dy - 8;
      if (shadowBounds && (showCapDebug || showRebuiltDebug)) {
        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
      }
      const roofLevelLabel = activeRoofLevel ? `${activeRoofLevel.level}` : "none";
      const cacheLabel = `shadow:v3-hybrid cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${shadowV1DebugGeometryMode} roofL:${roofLevelLabel} side:${debugShadowEntry.sideSemantic} cast:${debugShadowEntry.casterTriangles.length} top:${debugShadowEntry.topCasterTriangleCount} sideCast:${debugShadowEntry.sideCasterTriangleCount} seg:${debugShadowEntry.slicePerimeterSegments.length} strips:${debugShadowEntry.sliceShadowStrips.length} cap:${debugShadowEntry.projectedTopCapTriangles.length} rebuilt:${debugShadowEntry.projectedTriangles.length}`;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
      ctx.fillText(cacheLabel, labelX, labelY);
      ctx.restore();
    });
    return;
  }

  if (structureShadowV2CacheEntry) {
    const debugShadowEntry = structureShadowV2CacheEntry;
    deferredStructureSliceDebugDraws.push(() => {
      const showCapDebug = shadowV1DebugGeometryMode !== "connectorsOnly";
      const showConnectorDebug = shadowV1DebugGeometryMode !== "capOnly";
      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
      const roofCorner = activeRoofLevel?.quad?.[0] ?? null;
      ctx.save();
      ctx.lineWidth = 1;
      if (activeRoofLevel) {
        const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
        ctx.beginPath();
        ctx.moveTo(rnw.x, rnw.y);
        ctx.lineTo(rne.x, rne.y);
        ctx.lineTo(rse.x, rse.y);
        ctx.lineTo(rsw.x, rsw.y);
        ctx.closePath();
        ctx.strokeStyle = "rgba(255, 240, 180, 0.92)";
        ctx.stroke();
      }
      if (showCapDebug) {
        for (let ti = 0; ti < debugShadowEntry.projectedCapTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.projectedCapTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
          ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
          ctx.fill();
          ctx.stroke();
        }
      }
      if (showConnectorDebug) {
        for (let ti = 0; ti < debugShadowEntry.connectorTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.connectorTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(15, 20, 35, 0.20)";
          ctx.strokeStyle = "rgba(180, 210, 255, 0.90)";
          ctx.fill();
          ctx.stroke();
        }
      }
      for (let ei = 0; ei < debugShadowEntry.sourceBoundaryEdges.length; ei++) {
        const [a, b] = debugShadowEntry.sourceBoundaryEdges[ei];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(255, 150, 80, 0.97)";
        ctx.stroke();
      }
      for (let ei = 0; ei < debugShadowEntry.projectedBoundaryEdges.length; ei++) {
        const [a, b] = debugShadowEntry.projectedBoundaryEdges[ei];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(110, 190, 255, 0.98)";
        ctx.stroke();
      }
      const shadowBounds = debugShadowEntry.projectedBounds;
      const labelX = shadowBounds
        ? shadowBounds.x + 4
        : roofCorner
          ? roofCorner.x + 4
          : draw.dx + 4;
      const labelY = shadowBounds
        ? shadowBounds.y - 8
        : roofCorner
          ? roofCorner.y - 8
          : draw.dy - 8;
      if (shadowBounds) {
        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
      }
      const roofLevelLabel = activeRoofLevel ? `${activeRoofLevel.level}` : "none";
      const cacheLabel = `shadow:v2 cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${shadowV1DebugGeometryMode} roofL:${roofLevelLabel} castH:${Math.round(debugShadowEntry.castHeightPx)} loops:${debugShadowEntry.sourceBoundaryLoops.length} edge:${debugShadowEntry.sourceBoundaryEdges.length} cap:${debugShadowEntry.projectedCapTriangles.length} conn:${debugShadowEntry.connectorTriangles.length}`;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
      ctx.fillText(cacheLabel, labelX, labelY);
      ctx.restore();
    });
    return;
  }

  if (structureShadowV1CacheEntry) {
    const debugShadowEntry = structureShadowV1CacheEntry;
    deferredStructureSliceDebugDraws.push(() => {
      const activeRoofLevel = debugShadowEntry.roofScan.activeLevel;
      if (!activeRoofLevel) return;
      const showCapDebug = shadowV1DebugGeometryMode !== "connectorsOnly";
      const showConnectorDebug = shadowV1DebugGeometryMode !== "capOnly";
      ctx.save();
      ctx.lineWidth = 1;
      for (let ti = 0; ti < debugShadowEntry.roofCasterTriangles.length; ti++) {
        const tri = debugShadowEntry.roofCasterTriangles[ti];
        const [a, b, c] = tri.points;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 220, 90, 0.32)";
        ctx.strokeStyle = "rgba(255, 245, 175, 0.98)";
        ctx.fill();
        ctx.stroke();
      }
      const [rnw, rne, rse, rsw] = activeRoofLevel.quad;
      ctx.beginPath();
      ctx.moveTo(rnw.x, rnw.y);
      ctx.lineTo(rne.x, rne.y);
      ctx.lineTo(rse.x, rse.y);
      ctx.lineTo(rsw.x, rsw.y);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 240, 180, 0.96)";
      ctx.stroke();
      if (showCapDebug) {
        for (let ti = 0; ti < debugShadowEntry.projectedTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.projectedTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
          ctx.strokeStyle = "rgba(130, 170, 255, 0.95)";
          ctx.fill();
          ctx.stroke();
        }
      }
      if (showConnectorDebug) {
        for (let ti = 0; ti < debugShadowEntry.connectorTriangles.length; ti++) {
          const [a, b, c] = debugShadowEntry.connectorTriangles[ti];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(15, 20, 35, 0.20)";
          ctx.strokeStyle = "rgba(175, 200, 255, 0.90)";
          ctx.fill();
          ctx.stroke();
        }
      }
      for (let ei = 0; ei < debugShadowEntry.roofBoundaryEdges.length; ei++) {
        const [a, b] = debugShadowEntry.roofBoundaryEdges[ei];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(255, 140, 70, 0.98)";
        ctx.stroke();
      }
      for (let ei = 0; ei < debugShadowEntry.footprintBoundaryEdges.length; ei++) {
        const [a, b] = debugShadowEntry.footprintBoundaryEdges[ei];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(140, 255, 170, 0.95)";
        ctx.stroke();
      }
      for (let ei = 0; ei < debugShadowEntry.projectedBoundaryEdges.length; ei++) {
        const [a, b] = debugShadowEntry.projectedBoundaryEdges[ei];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(110, 190, 255, 0.98)";
        ctx.stroke();
      }
      const shadowBounds = debugShadowEntry.projectedBounds;
      const labelX = shadowBounds ? shadowBounds.x + 4 : rnw.x + 4;
      const labelY = shadowBounds ? shadowBounds.y - 8 : rnw.y - 8;
      if (shadowBounds) {
        ctx.strokeStyle = "rgba(120, 170, 255, 0.95)";
        ctx.strokeRect(shadowBounds.x, shadowBounds.y, shadowBounds.w, shadowBounds.h);
      }
      const cacheLabel = `shadow:v1 cache:${debugShadowCacheHit ? "hit" : "rebuild"} mode:${shadowV1DebugGeometryMode} roofL:${activeRoofLevel.level} cast:${debugShadowEntry.roofCasterTriangles.length} edge:${debugShadowEntry.roofBoundaryEdges.length} base:${debugShadowEntry.footprintBoundaryEdges.length} cap:${debugShadowEntry.projectedTriangles.length} conn:${debugShadowEntry.connectorTriangles.length}`;
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
      ctx.fillText(cacheLabel, labelX + 1, labelY + 1);
      ctx.fillStyle = "rgba(210, 230, 255, 0.97)";
      ctx.fillText(cacheLabel, labelX, labelY);
      ctx.restore();
  });
}
}
