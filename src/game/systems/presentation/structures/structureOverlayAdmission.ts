import { type ViewRect, getActiveMap as getActiveCompiledMap } from "../../../map/compile/kenneyMap";
import { mapWideOverlayViewRect } from "../../../structures/monolithicStructureGeometry";
import type {
  StructureAdmissionMode,
  StructureOverlayAdmissionContext,
  StructureTileBounds,
} from "./structurePresentationTypes";

export type ResolveStructureOverlayAdmissionContextInput = {
  compiledMap: ReturnType<typeof getActiveCompiledMap>;
  strictViewportTileBounds: StructureTileBounds;
  viewRect: ViewRect;
  structureTriangleAdmissionMode: StructureAdmissionMode;
};

export function resolveStructureOverlayAdmissionContext(
  input: ResolveStructureOverlayAdmissionContextInput,
): StructureOverlayAdmissionContext {
  const triangleOverlayPrefilterBounds = input.structureTriangleAdmissionMode === "viewport"
    ? input.strictViewportTileBounds
    : input.viewRect;

  // Monolithic triangle geometry is always the visibility authority for STRUCTURE overlays.
  // Keep a map-wide prefilter so footprint culling does not run before triangle admission.
  const overlayPrefilterViewRect = mapWideOverlayViewRect(input.compiledMap);

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
