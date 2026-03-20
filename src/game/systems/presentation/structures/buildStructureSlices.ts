import { buildRuntimeStructureBandPieces } from "../../../../engine/render/sprites/runtimeStructureSlicing";
import { seAnchorFromTopLeft } from "../../../../engine/render/sprites/structureFootprintOwnership";
import type { ShadowV6SemanticBucket } from "../../../../settings/settingsTypes";
import {
  resolveRuntimeStructureBandProgressionIndex,
  rectIntersects as runtimeStructureRectIntersects,
  type RuntimeStructureTriangleRect,
  type RuntimeStructureTriangleCacheStore,
} from "../runtimeStructureTriangles";
import { pointInTriangle } from "../structureTriangles/structureTriangleCulling";
import { runtimeStructureTriangleGeometrySignatureForOverlay } from "../structureTriangles/structureTriangleCacheRebuild";
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
import type {
  StructureShadowHybridCacheEntry,
  StructureShadowHybridCacheStore,
} from "../structureShadowHybridTriangles";
import type {
  StructureShadowV4CacheEntry,
  StructureShadowV4CacheStore,
} from "../structureShadowV4";
import { STATIC_RELIGHT_INCLUDE_STRUCTURES } from "../staticRelight/staticRelightBakeRebuild";
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
type StructureTriangleSemanticClass =
  | "TOP"
  | "LEFT_SOUTH"
  | "RIGHT_EAST"
  | "UNCLASSIFIED"
  | "CONFLICT";

const STRUCTURE_FOOTPRINT_SCAN_STEP_PX = 64;

type BuildStructureSlicesInput = {
  ctx: CanvasRenderingContext2D;
  candidates: readonly StructureOverlayCandidate[];
  tileWorld: number;
  projectedViewportRect: RuntimeStructureTriangleRect;
  strictViewportTileBounds: StructureTileBounds;
  structureTriangleGeometryEnabled: boolean;
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
  runtimeStructureTriangleCacheStore: RuntimeStructureTriangleCacheStore;
  getFlippedOverlayImage: (img: HTMLImageElement) => HTMLCanvasElement;
  showStructureSliceDebug: boolean;
  showStructureTriangleFootprintDebug: boolean;
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

    if (candidate.useRuntimeStructureSlicing) {
      const bandPieces = buildRuntimeStructureBandPieces({
        structureInstanceId: o.id,
        spriteId: o.spriteId,
        seTx: o.seTx,
        seTy: o.seTy,
        footprintW: o.w,
        footprintH: o.h,
        flipped: !!o.flipX,
        sliceOffsetX: o.sliceOffsetPx?.x ?? 0,
        sliceOffsetY: o.sliceOffsetPx?.y ?? 0,
        sliceOriginX: o.sliceOriginPx?.x,
        baseZ: o.z,
        baseDx: draw.dx,
        baseDy: draw.dy,
        spriteWidth: draw.dw,
        spriteHeight: draw.dh,
        scale: draw.scale ?? 1,
      });

      if (input.logStructureOwnershipDebug && !input.loggedStructureOwnershipDebugIds.has(o.id)) {
        input.loggedStructureOwnershipDebugIds.add(o.id);
        const oriented = { w: Math.max(1, o.w | 0), h: Math.max(1, o.h | 0) };
        const expectedSE = seAnchorFromTopLeft(o.tx, o.ty, oriented.w, oriented.h);
        const owners = bandPieces.map((piece) => ({
          tx: piece.renderKey.within,
          ty: piece.renderKey.slice - piece.renderKey.within,
        }));
        console.log("[structure-ownership]", {
          structureId: o.id,
          flipped: !!o.flipX,
          w: oriented.w,
          h: oriented.h,
          anchorTx: o.seTx,
          anchorTy: o.seTy,
          seMatchesTopLeft: o.seTx === expectedSE.anchorTx && o.seTy === expectedSE.anchorTy,
          first3: owners.slice(0, 3),
          last3: owners.slice(Math.max(0, owners.length - 3)),
        });
      }

      let usedTriangleGeometryPath = false;
      if (input.structureTriangleGeometryEnabled && o.layerRole === "STRUCTURE") {
        const geometrySignature = runtimeStructureTriangleGeometrySignatureForOverlay(o, {
          dx: draw.dx,
          dy: draw.dy,
          dw: draw.dw,
          dh: draw.dh,
          flipX: !!draw.flipX,
          scale: draw.scale ?? 1,
        });
        const triangleCache = input.runtimeStructureTriangleCacheStore.get(o.id, geometrySignature);

        if (triangleCache && draw.img) {
          usedTriangleGeometryPath = true;
          const sourceImg: CanvasImageSource = draw.flipX ? input.getFlippedOverlayImage(draw.img) : draw.img;
          const usingV5Caster = input.structureShadowFrame.routing.usesV5;
          const usingV6Caster = input.structureShadowFrame.routing.usesV6;
          const admittedTrianglesForSemanticMasks: typeof triangleCache.triangles = [];
          const footprintW = Math.max(1, o.w | 0);
          const footprintH = Math.max(1, o.h | 0);
          const buildingMinCameraTx = o.tx;
          const buildingMaxCameraTx = o.tx + footprintW - 1;
          const buildingMinCameraTy = o.ty;
          const buildingMaxCameraTy = o.ty + footprintH - 1;
          const buildingDirectionalRejected = (
            buildingMaxCameraTx < input.playerCameraTx
            || buildingMaxCameraTy < input.playerCameraTy
          );
          const buildingDirectionalEligible = !buildingDirectionalRejected;
          const projectedFootprintQuad = input.showStructureTriangleFootprintDebug
            ? buildProjectedStructureFootprintQuad(o, input.tileWorld, input.toScreenAtZ)
            : null;
          let overlayHasVisibleTriangleGroup = false;

          if (input.showStructureSliceDebug && input.structureTriangleCutoutEnabled && !didQueueStructureCutoutDebugRect) {
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
              input.ctx.font = "11px monospace";
              const labelPos = input.toScreenAtZ(input.playerCameraTx * input.tileWorld, input.playerCameraTy * input.tileWorld, 0);
              const label = `cutout screenRect C:${input.playerCameraTx},${input.playerCameraTy} w:${input.structureTriangleCutoutHalfWidth} h:${input.structureTriangleCutoutHalfHeight} px:${Math.round(wRect)}x${Math.round(hRect)} a:${input.structureTriangleCutoutAlpha.toFixed(2)}`;
              input.ctx.fillStyle = "rgba(0,0,0,0.8)";
              input.ctx.fillText(label, labelPos.x + 9, labelPos.y - 7);
              input.ctx.fillStyle = "rgba(185,145,255,0.95)";
              input.ctx.fillText(label, labelPos.x + 8, labelPos.y - 8);
              input.ctx.restore();
            });
          }

          for (let gi = 0; gi < triangleCache.parentTileGroups.length; gi++) {
            const group = triangleCache.parentTileGroups[gi];
            const groupParentAfterPlayer = input.isParentTileAfterPlayer(group.parentTx, group.parentTy);
            const groupBoundsInViewport = runtimeStructureRectIntersects(group.localBounds, input.projectedViewportRect);
            const viewportVisibleTriangles = [] as typeof group.triangles;
            const renderDistanceVisibleTriangles = [] as typeof group.triangles;
            const finalVisibleTriangles = [] as typeof group.triangles;
            const cutoutEligibleTriangles = [] as typeof group.triangles;
            let cutoutBuildingRejectedCount = 0;
            const compareDistanceOnlyTriangles = [] as typeof group.triangles;

            for (let ti = 0; ti < group.triangles.length; ti++) {
              const tri = group.triangles[ti];
              const viewportVisible = isCameraTileInsideBounds(
                tri.cameraTx,
                tri.cameraTy,
                input.strictViewportTileBounds,
              );
              const renderDistanceVisible = input.isTileInRenderRadius(tri.cameraTx, tri.cameraTy);
              if (viewportVisible) viewportVisibleTriangles.push(tri);
              if (renderDistanceVisible) renderDistanceVisibleTriangles.push(tri);
              const finalVisible = isTriangleVisibleForAdmissionMode(
                input.structureTriangleAdmissionMode,
                viewportVisible,
                renderDistanceVisible,
              );
              if (finalVisible) {
                finalVisibleTriangles.push(tri);
                if (input.structureTriangleAdmissionMode === "compare" && renderDistanceVisible && !viewportVisible) {
                  compareDistanceOnlyTriangles.push(tri);
                }
                if (input.structureTriangleCutoutEnabled && !buildingDirectionalEligible) cutoutBuildingRejectedCount++;
                const triCenterX = (tri.points[0].x + tri.points[1].x + tri.points[2].x) / 3;
                const triCenterY = (tri.points[0].y + tri.points[1].y + tri.points[2].y) / 3;
                const cutoutEligible = input.structureTriangleCutoutEnabled
                  && buildingDirectionalEligible
                  && groupParentAfterPlayer
                  && input.isPointInsideStructureCutoutScreenRect(triCenterX, triCenterY);
                if (cutoutEligible) cutoutEligibleTriangles.push(tri);
              }
            }

            const finalAdmitted = finalVisibleTriangles.length > 0;
            if (input.showStructureSliceDebug) {
              input.deferredStructureSliceDebugDraws.push(() => {
                input.ctx.save();
                const bounds = group.localBounds;
                const admittedViewportStyle = finalAdmitted && compareDistanceOnlyTriangles.length === 0;
                input.ctx.lineWidth = admittedViewportStyle ? 1.5 : 1;
                input.ctx.strokeStyle = admittedViewportStyle
                  ? "rgba(0,255,170,0.92)"
                  : compareDistanceOnlyTriangles.length > 0
                    ? "rgba(255,120,40,0.92)"
                    : "rgba(255,180,90,0.65)";
                input.ctx.fillStyle = admittedViewportStyle
                  ? "rgba(0,255,170,0.08)"
                  : compareDistanceOnlyTriangles.length > 0
                    ? "rgba(255,120,40,0.08)"
                    : "rgba(255,180,90,0.04)";
                input.ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
                input.ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
                for (let ti = 0; ti < group.triangles.length; ti++) {
                  const tri = group.triangles[ti];
                  const [a, b, c] = tri.points;
                  input.ctx.beginPath();
                  input.ctx.moveTo(a.x, a.y);
                  input.ctx.lineTo(b.x, b.y);
                  input.ctx.lineTo(c.x, c.y);
                  input.ctx.closePath();
                  input.ctx.strokeStyle = admittedViewportStyle
                    ? "rgba(0,255,170,0.72)"
                    : compareDistanceOnlyTriangles.length > 0
                      ? "rgba(255,120,40,0.72)"
                      : "rgba(255,180,90,0.38)";
                  input.ctx.stroke();
                }
                const labelX = bounds.x + bounds.w * 0.5;
                const labelY = bounds.y + bounds.h * 0.5;
                const representativeCamera = finalVisibleTriangles[0] ?? group.triangles[0] ?? null;
                const labelSuffix = compareDistanceOnlyTriangles.length > 0 ? " rd-only" : "";
                const label = representativeCamera
                  ? `P:${group.parentTx},${group.parentTy} C:${representativeCamera.cameraTx},${representativeCamera.cameraTy}${labelSuffix}`
                  : `P:${group.parentTx},${group.parentTy}${labelSuffix}`;
                input.ctx.font = "10px monospace";
                input.ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
                input.ctx.fillText(label, labelX + 1, labelY + 1);
                input.ctx.fillStyle = admittedViewportStyle
                  ? "rgba(0,255,170,0.96)"
                  : compareDistanceOnlyTriangles.length > 0
                    ? "rgba(255,120,40,0.95)"
                    : "rgba(255,180,90,0.95)";
                input.ctx.fillText(label, labelX, labelY);
                const statsLabel = `vis:${finalVisibleTriangles.length}/${group.triangles.length} vp:${viewportVisibleTriangles.length} rd:${renderDistanceVisibleTriangles.length} cut:${cutoutEligibleTriangles.length} bdir:${buildingDirectionalEligible ? "pass" : "rej"} brej:${cutoutBuildingRejectedCount} bbox:${buildingMinCameraTx},${buildingMinCameraTy}-${buildingMaxCameraTx},${buildingMaxCameraTy} gb:${groupBoundsInViewport ? 1 : 0}`;
                input.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
                input.ctx.fillText(statsLabel, labelX + 1, labelY + 12);
                input.ctx.fillStyle = "rgba(220, 240, 255, 0.95)";
                input.ctx.fillText(statsLabel, labelX, labelY + 11);
                input.ctx.restore();
              });
            }
            if (!finalAdmitted) continue;

            if (usingV5Caster || usingV6Caster) admittedTrianglesForSemanticMasks.push(...finalVisibleTriangles);
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

          if (overlayHasVisibleTriangleGroup) {
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
            const structureShadowV1CacheEntry = structureShadowResult.structureShadowV1CacheEntry;
            const structureShadowV2CacheEntry = structureShadowResult.structureShadowV2CacheEntry;
            const structureShadowHybridCacheEntry = structureShadowResult.structureShadowHybridCacheEntry;
            const structureShadowV4CacheEntry = structureShadowResult.structureShadowV4CacheEntry;
            const debugShadowCacheHit = structureShadowResult.structureShadowCacheHit;

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

            queueStructureTriangleFootprintShadowDebugDraws({
              ctx: input.ctx,
              showStructureTriangleFootprintDebug: input.showStructureTriangleFootprintDebug,
              deferredStructureSliceDebugDraws: input.deferredStructureSliceDebugDraws,
              structureShadowV1CacheEntry,
              structureShadowV2CacheEntry,
              structureShadowHybridCacheEntry,
              structureShadowV4CacheEntry,
              debugShadowCacheHit,
              draw,
              shadowV1DebugGeometryMode: input.shadowV1DebugGeometryMode,
            });
          }

          if (input.showStructureTriangleFootprintDebug && projectedFootprintQuad && overlayHasVisibleTriangleGroup) {
            const allTriangles = triangleCache.triangles;
            const triangleCentroids: Array<{ tri: typeof allTriangles[number]; centroid: ScreenPt }> = [];
            const centroidPoints: ScreenPt[] = [];
            for (let ti = 0; ti < allTriangles.length; ti++) {
              const tri = allTriangles[ti];
              const [a, b, c] = tri.points;
              const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
              triangleCentroids.push({ tri, centroid });
              centroidPoints.push(centroid);
            }
            const supportScan = scanLiftedFootprintSupportLevels(
              projectedFootprintQuad,
              footprintW,
              footprintH,
              centroidPoints,
            );
            const activeLevelIndex = supportScan.highestValidLevel >= 0 ? supportScan.highestValidLevel : 0;
            const activeLevel = supportScan.levels[Math.min(activeLevelIndex, supportScan.levels.length - 1)] ?? null;
            const leftSouthMaxProgression = footprintW - 1;
            const rightEastMinProgression = footprintW;
            const progressionByOwnerTile = new Map<string, { min: number; max: number }>();
            for (let bi = 0; bi < bandPieces.length; bi++) {
              const band = bandPieces[bi];
              const ownerTx = band.renderKey.within;
              const ownerTy = band.renderKey.slice - band.renderKey.within;
              const ownerKey = `${ownerTx},${ownerTy}`;
              const progression = resolveRuntimeStructureBandProgressionIndex(band.index, footprintW, footprintH);
              const existing = progressionByOwnerTile.get(ownerKey);
              if (!existing) {
                progressionByOwnerTile.set(ownerKey, { min: progression, max: progression });
              } else {
                if (progression < existing.min) existing.min = progression;
                if (progression > existing.max) existing.max = progression;
              }
            }
            const semanticCounts: Record<StructureTriangleSemanticClass, number> = {
              TOP: 0,
              LEFT_SOUTH: 0,
              RIGHT_EAST: 0,
              UNCLASSIFIED: 0,
              CONFLICT: 0,
            };
            const semanticTriangles = triangleCentroids.map((entry) => {
              const ownerKey = `${entry.tri.parentTx},${entry.tri.parentTy}`;
              const ownerRange = progressionByOwnerTile.get(ownerKey);
              const isTop = !!activeLevel && isPointInsideProjectedStructureFootprintQuad(
                activeLevel.quad,
                entry.centroid.x,
                entry.centroid.y,
              );
              const leftCandidate = !!ownerRange && ownerRange.min <= leftSouthMaxProgression;
              const rightCandidate = !!ownerRange && ownerRange.max >= rightEastMinProgression;
              let semantic: StructureTriangleSemanticClass = "UNCLASSIFIED";
              if (isTop) {
                semantic = "TOP";
              } else if (leftCandidate && rightCandidate) {
                semantic = "CONFLICT";
              } else if (leftCandidate) {
                semantic = "LEFT_SOUTH";
              } else if (rightCandidate) {
                semantic = "RIGHT_EAST";
              }
              semanticCounts[semantic]++;
              return {
                tri: entry.tri,
                centroid: entry.centroid,
                semantic,
              };
            });
            input.deferredStructureSliceDebugDraws.push(() => {
              if (!activeLevel) return;
              input.ctx.save();
              input.ctx.lineWidth = 1;
              for (let ti = 0; ti < semanticTriangles.length; ti++) {
                const entry = semanticTriangles[ti];
                const tri = entry.tri;
                const [a, b, c] = tri.points;
                input.ctx.beginPath();
                input.ctx.moveTo(a.x, a.y);
                input.ctx.lineTo(b.x, b.y);
                input.ctx.lineTo(c.x, c.y);
                input.ctx.closePath();
                if (entry.semantic === "TOP") {
                  input.ctx.fillStyle = "rgba(255, 216, 64, 0.30)";
                  input.ctx.strokeStyle = "rgba(255, 240, 170, 0.95)";
                } else if (entry.semantic === "LEFT_SOUTH") {
                  input.ctx.fillStyle = "rgba(85, 210, 255, 0.24)";
                  input.ctx.strokeStyle = "rgba(150, 240, 255, 0.95)";
                } else if (entry.semantic === "RIGHT_EAST") {
                  input.ctx.fillStyle = "rgba(255, 150, 80, 0.24)";
                  input.ctx.strokeStyle = "rgba(255, 195, 130, 0.95)";
                } else if (entry.semantic === "CONFLICT") {
                  input.ctx.fillStyle = "rgba(255, 80, 220, 0.26)";
                  input.ctx.strokeStyle = "rgba(255, 150, 240, 0.96)";
                } else {
                  input.ctx.fillStyle = "rgba(95, 120, 150, 0.18)";
                  input.ctx.strokeStyle = "rgba(180, 205, 235, 0.82)";
                }
                input.ctx.fill();
                input.ctx.stroke();
              }
              for (let ci = 0; ci < activeLevel.cells.length; ci++) {
                const cell = activeLevel.cells[ci];
                const [c0, c1, c2, c3] = cell.quad;
                input.ctx.beginPath();
                input.ctx.moveTo(c0.x, c0.y);
                input.ctx.lineTo(c1.x, c1.y);
                input.ctx.lineTo(c2.x, c2.y);
                input.ctx.lineTo(c3.x, c3.y);
                input.ctx.closePath();
                input.ctx.fillStyle = cell.supported
                  ? "rgba(120, 255, 145, 0.07)"
                  : "rgba(255, 90, 90, 0.16)";
                input.ctx.strokeStyle = cell.supported
                  ? "rgba(120, 255, 145, 0.42)"
                  : "rgba(255, 110, 110, 0.88)";
                input.ctx.fill();
                input.ctx.stroke();
              }
              const [nw, ne, se, sw] = activeLevel.quad;
              input.ctx.beginPath();
              input.ctx.moveTo(nw.x, nw.y);
              input.ctx.lineTo(ne.x, ne.y);
              input.ctx.lineTo(se.x, se.y);
              input.ctx.lineTo(sw.x, sw.y);
              input.ctx.closePath();
              input.ctx.fillStyle = activeLevel.allSupported
                ? "rgba(120, 255, 145, 0.10)"
                : "rgba(255, 120, 120, 0.08)";
              input.ctx.strokeStyle = activeLevel.allSupported
                ? "rgba(120, 255, 145, 0.95)"
                : "rgba(255, 140, 140, 0.95)";
              input.ctx.fill();
              input.ctx.stroke();
              const roofLevelLabel = supportScan.highestValidLevel >= 0
                ? `${supportScan.highestValidLevel}`
                : "none";
              const labelX = nw.x + 8;
              const labelY = nw.y - 8;
              input.ctx.font = "10px monospace";
              const header = `roof:${roofLevelLabel} active:${activeLevel.level} lift:${Math.round(activeLevel.liftYPx)} cells:${activeLevel.supportedCells}/${activeLevel.totalCells}`;
              input.ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
              input.ctx.fillText(header, labelX + 1, labelY + 1);
              input.ctx.fillStyle = "rgba(235, 255, 235, 0.96)";
              input.ctx.fillText(header, labelX, labelY);
              const semanticLabel = `TOP:${semanticCounts.TOP} LS:${semanticCounts.LEFT_SOUTH} RE:${semanticCounts.RIGHT_EAST} U:${semanticCounts.UNCLASSIFIED} C:${semanticCounts.CONFLICT}`;
              input.ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
              input.ctx.fillText(semanticLabel, labelX + 1, labelY + 12);
              input.ctx.fillStyle = "rgba(235, 240, 255, 0.96)";
              input.ctx.fillText(semanticLabel, labelX, labelY + 11);
              const ownershipLabel = `ranges first:${footprintW + 1} last:${footprintH + 1} split@i=${rightEastMinProgression}`;
              input.ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
              input.ctx.fillText(ownershipLabel, labelX + 1, labelY + 23);
              input.ctx.fillStyle = "rgba(230, 230, 230, 0.95)";
              input.ctx.fillText(ownershipLabel, labelX, labelY + 22);
              const maxLevelRows = 6;
              for (let li = 0; li < supportScan.levels.length && li < maxLevelRows; li++) {
                const level = supportScan.levels[li];
                const rowY = labelY + 34 + li * 11;
                const levelLabel = `L${level.level}: ${level.supportedCells}/${level.totalCells} ${level.allSupported ? "ok" : "fail"}`;
                input.ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
                input.ctx.fillText(levelLabel, labelX + 1, rowY + 1);
                input.ctx.fillStyle = level.allSupported
                  ? "rgba(150, 255, 175, 0.95)"
                  : "rgba(255, 160, 160, 0.96)";
                input.ctx.fillText(levelLabel, labelX, rowY);
              }
              if (supportScan.levels.length > maxLevelRows) {
                const rowY = labelY + 34 + maxLevelRows * 11;
                const overflowLabel = `... +${supportScan.levels.length - maxLevelRows} levels`;
                input.ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
                input.ctx.fillText(overflowLabel, labelX + 1, rowY + 1);
                input.ctx.fillStyle = "rgba(220, 220, 220, 0.95)";
                input.ctx.fillText(overflowLabel, labelX, rowY);
              }
              input.ctx.restore();
            });
          }
        }
      }

      if (usedTriangleGeometryPath) continue;

      const sourceImg: CanvasImageSource = draw.flipX ? input.getFlippedOverlayImage(draw.img) : draw.img;
      for (let bi = 0; bi < bandPieces.length; bi++) {
        const band = bandPieces[bi];
        const ownerTx = band.renderKey.within;
        const ownerTy = band.renderKey.slice - band.renderKey.within;
        if (!input.isTileInRenderRadius(ownerTx, ownerTy)) continue;
        pieces.push({
          kind: "band",
          overlay: o,
          draw,
          sourceImage: sourceImg,
          band,
          structureSouthTieBreak,
          staticRelightFrame: input.staticRelightFrame,
          staticRelightEnabledForStructures: STATIC_RELIGHT_INCLUDE_STRUCTURES,
        });
      }
    } else {
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

function buildProjectedStructureFootprintQuad(
  overlay: {
    tx: number;
    ty: number;
    w: number;
    h: number;
    z: number;
    zVisualOffsetUnits?: number;
  },
  tileWorld: number,
  toScreenAtZ: (worldX: number, worldY: number, zVisual: number) => ScreenPt,
): ProjectedQuad {
  const zVisual = overlay.z + (overlay.zVisualOffsetUnits ?? 0);
  const minWorldX = overlay.tx * tileWorld;
  const minWorldY = overlay.ty * tileWorld;
  const maxWorldX = (overlay.tx + overlay.w) * tileWorld;
  const maxWorldY = (overlay.ty + overlay.h) * tileWorld;
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
