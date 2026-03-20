import { type ViewRect, getActiveMap as getActiveCompiledMap } from "../../../map/compile/kenneyMap";
import { mapWideOverlayViewRect } from "../structureTriangles/structureTriangleCacheRebuild";
import type {
  StructureAdmissionMode,
  StructureOverlayAdmissionContext,
  StructureTileBounds,
} from "./structurePresentationTypes";

export type ResolveStructureOverlayAdmissionContextInput = {
  compiledMap: ReturnType<typeof getActiveCompiledMap>;
  strictViewportTileBounds: StructureTileBounds;
  viewRect: ViewRect;
  structureTriangleGeometryEnabled: boolean;
  structureTriangleAdmissionMode: StructureAdmissionMode;
};

export function resolveStructureOverlayAdmissionContext(
  input: ResolveStructureOverlayAdmissionContextInput,
): StructureOverlayAdmissionContext {
  const triangleOverlayPrefilterBounds = input.structureTriangleAdmissionMode === "viewport"
    ? input.strictViewportTileBounds
    : input.viewRect;

  // In triangle-geometry mode, STRUCTURE visibility authority is triangle camera-tiles.
  // So we must not cull structures by overlay footprint before triangle admission runs.
  const overlayPrefilterViewRect = input.structureTriangleGeometryEnabled
    ? mapWideOverlayViewRect(input.compiledMap)
    : input.viewRect;

  return {
    triangleOverlayPrefilterBounds,
    overlayPrefilterViewRect,
  };
}

export function isCameraTileInsideBounds(
  tx: number,
  ty: number,
  bounds: StructureTileBounds,
): boolean {
  return tx >= bounds.minTx
    && tx <= bounds.maxTx
    && ty >= bounds.minTy
    && ty <= bounds.maxTy;
}

export function isTriangleVisibleForAdmissionMode(
  structureTriangleAdmissionMode: StructureAdmissionMode,
  viewportVisible: boolean,
  renderDistanceVisible: boolean,
): boolean {
  if (structureTriangleAdmissionMode === "viewport") return viewportVisible;
  if (structureTriangleAdmissionMode === "renderDistance") return renderDistanceVisible;
  if (structureTriangleAdmissionMode === "hybrid") return viewportVisible && renderDistanceVisible;
  return renderDistanceVisible;
}

export function tileRectIntersectsBounds(
  minRectTx: number,
  maxRectTx: number,
  minRectTy: number,
  maxRectTy: number,
  bounds: StructureTileBounds,
): boolean {
  return !(
    maxRectTx < bounds.minTx
    || minRectTx > bounds.maxTx
    || maxRectTy < bounds.minTy
    || minRectTy > bounds.maxTy
  );
}
