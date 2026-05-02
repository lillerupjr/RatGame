// @system   structure-geometry/slicing
// @owns     convert structure slice pieces into drawable payloads with parent-tile render keys
// @doc      docs/canonical/structure_geometry_slicing_system.md
// @agents   no slice construction, triangle-cache building, or backend submission — see buildStructureSlices.ts, monolithicStructureGeometry.ts, and renderWorldConsumers.ts

import { deriveParentTileRenderFields } from "../../../structures/monolithicStructureGeometry";
import { KindOrder, type RenderKey } from "../worldRenderOrdering";
import type {
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
        feetSortY: piece.feetSortY,
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

    const slice = piece.overlay.seTx + piece.overlay.seTy;
    const within = piece.overlay.seTx;
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
