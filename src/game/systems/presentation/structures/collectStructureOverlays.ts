import { overlaysInView, type StampOverlay } from "../../../map/compile/kenneyMap";
import type {
  StructureOverlayCandidate,
  StructureOverlayDraw,
  StructureOverlayAdmissionContext,
  StructureSouthTieBreak,
} from "./structurePresentationTypes";

export type CollectStructureOverlaysInput = {
  showMapOverlays: boolean;
  admission: StructureOverlayAdmissionContext;
  tileRectIntersectsRenderRadius: (
    minRectTx: number,
    maxRectTx: number,
    minRectTy: number,
    maxRectTy: number,
  ) => boolean;
  shouldCullBuildingAt: (tx: number, ty: number, w?: number, h?: number) => boolean;
  buildOverlayDraw: (overlay: StampOverlay) => StructureOverlayDraw | null;
  deriveStructureSouthTieBreakFromSeAnchor: (
    seTx: number,
    seTy: number,
  ) => StructureSouthTieBreak;
};

export function collectStructureOverlays(input: CollectStructureOverlaysInput): StructureOverlayCandidate[] {
  if (!input.showMapOverlays) return [];

  const overlays = overlaysInView(input.admission.overlayPrefilterViewRect);
  const out: StructureOverlayCandidate[] = [];

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    const passesOverlayCoarsePrefilter = overlay.layerRole === "STRUCTURE"
      ? true
      : input.tileRectIntersectsRenderRadius(
        overlay.tx,
        overlay.tx + overlay.w - 1,
        overlay.ty,
        overlay.ty + overlay.h - 1,
      );
    if (!passesOverlayCoarsePrefilter) continue;
    if ((overlay.kind ?? "ROOF") === "ROOF" && input.shouldCullBuildingAt(overlay.tx, overlay.ty, overlay.w, overlay.h)) {
      continue;
    }

    const draw = input.buildOverlayDraw(overlay);
    if (!draw) continue;

    const structureSouthTieBreak = overlay.layerRole === "STRUCTURE"
      ? input.deriveStructureSouthTieBreakFromSeAnchor(overlay.seTx, overlay.seTy)
      : null;

    out.push({
      overlayIndex: i,
      overlay,
      draw,
      structureSouthTieBreak,
      useRuntimeStructureSlicing: overlay.layerRole === "STRUCTURE",
    });
  }

  return out;
}
