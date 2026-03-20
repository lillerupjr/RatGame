import { structureSliceRelightPieceKey } from "../staticRelight/staticRelightBakeRebuild";
import { deriveParentTileRenderFields } from "../runtimeStructureTriangles";
import { KindOrder, type RenderKey } from "../worldRenderOrdering";
import type {
  StructureBandSlicePiece,
  StructureDrawable,
  StructureSlicePiece,
} from "./structurePresentationTypes";

export function buildStructureDrawables(
  pieces: readonly StructureSlicePiece[],
): StructureDrawable[] {
  const out: StructureDrawable[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];

    if (piece.kind === "triangleGroup") {
      const renderFields = deriveParentTileRenderFields(piece.parentTx, piece.parentTy);
      const key: RenderKey = {
        slice: renderFields.slice,
        within: renderFields.within,
        baseZ: piece.overlay.z,
        kindOrder: KindOrder.STRUCTURE,
        ...(piece.structureSouthTieBreak ?? {}),
        stableId: piece.stableId,
      };
      out.push({
        slice: renderFields.slice,
        key,
        payload: {
          kind: "triangleGroup",
          piece,
        },
      });
      continue;
    }

    if (piece.kind === "band") {
      const key: RenderKey = {
        slice: piece.band.renderKey.slice,
        within: piece.band.renderKey.within,
        baseZ: piece.band.renderKey.baseZ,
        kindOrder: KindOrder.STRUCTURE,
        ...(piece.structureSouthTieBreak ?? {}),
        stableId: piece.band.renderKey.stableId,
      };

      out.push({
        slice: piece.band.renderKey.slice,
        key,
        payload: {
          kind: "band",
          piece,
          staticRelightPieceKey: resolveStructureBandRelightPieceKey(piece),
        },
      });
      continue;
    }

    const slice = (piece.overlay.anchorTx ?? (piece.overlay.tx + piece.overlay.w - 1))
      + (piece.overlay.anchorTy ?? (piece.overlay.ty + piece.overlay.h - 1));
    const within = piece.overlay.anchorTx ?? (piece.overlay.tx + piece.overlay.w - 1);
    const kindOrder = piece.overlay.layerRole === "STRUCTURE"
      ? KindOrder.STRUCTURE
      : (piece.overlay.kind ?? "ROOF") === "PROP"
        ? KindOrder.ENTITY
        : KindOrder.OVERLAY;
    const key: RenderKey = {
      slice,
      within,
      baseZ: piece.overlay.z,
      kindOrder,
      stableId: 200000 + piece.overlayIndex,
    };
    out.push({
      slice,
      key,
      payload: {
        kind: "overlay",
        piece,
        kindOrder,
        stableId: 200000 + piece.overlayIndex,
      },
    });
  }

  return out;
}

function resolveStructureBandRelightPieceKey(
  piece: StructureBandSlicePiece,
): string | null {
  if (!(piece.staticRelightEnabledForStructures && piece.overlay.layerRole === "STRUCTURE" && piece.staticRelightFrame)) {
    return null;
  }

  const ownerTx = piece.band.renderKey.within;
  const ownerTy = piece.band.renderKey.slice - piece.band.renderKey.within;
  const x0 = Math.round(piece.band.dstRect.x);
  const y0 = Math.round(piece.band.dstRect.y);
  const x1 = Math.round(piece.band.dstRect.x + piece.band.dstRect.w);
  const y1 = Math.round(piece.band.dstRect.y + piece.band.dstRect.h);
  const snappedW = Math.max(0, x1 - x0);
  const snappedH = Math.max(0, y1 - y0);
  if (snappedW <= 0 || snappedH <= 0) return null;

  return structureSliceRelightPieceKey(
    piece.overlay,
    piece.band.index,
    ownerTx,
    ownerTy,
    piece.band.srcRect.x,
    piece.band.srcRect.y,
    piece.band.srcRect.w,
    piece.band.srcRect.h,
    snappedW,
    snappedH,
    !!piece.draw.flipX,
  );
}
