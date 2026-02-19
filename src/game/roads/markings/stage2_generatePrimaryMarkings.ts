import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import {
  DOUBLE_LINE_OFFSET_TILES,
  ROAD_CENTER_MARKING_VARIANT_INDEX,
} from "../roadMarkings";
import { resolveMarkingPresetForWidth } from "./markingRegistry";
import type { MarkingPiece, RoadContext, RoadMarkingInputs } from "./types";

const EDGE_LINE_INSET_PX = 12;
const EDGE_LINE_INSET_TILES = EDGE_LINE_INSET_PX / KENNEY_TILE_WORLD;

export function generatePrimaryMarkings(context: RoadContext, inputs: RoadMarkingInputs): MarkingPiece[] {
  const out: MarkingPiece[] = [];
  const dedupe = new Set<string>();
  const edgeSeen = new Set<string>();
  const edgeVariant = 2;
  const dividerVariant = 4;

  const idx = (tx: number, ty: number): number => (tx - context.originTx) + (ty - context.originTy) * context.w;
  const inBounds = (tx: number, ty: number): boolean => {
    return tx >= context.originTx
      && tx < context.originTx + context.w
      && ty >= context.originTy
      && ty < context.originTy + context.h;
  };
  const suppress = (tx: number, ty: number): boolean => {
    if (!inBounds(tx, ty)) return true;
    const i = idx(tx, ty);
    if (inputs.roadIntersectionMaskWorld[i] === 1) return true;
    if (inputs.roadCrossingMaskWorld[i] === 1) return true;
    return false;
  };

  const push = (
    tx: number,
    ty: number,
    variant: number,
    rot: 0 | 1,
    keySuffix: string,
    sampleTx: number,
    sampleTy: number,
  ) => {
    const z = inputs.getTileZAt(sampleTx, sampleTy);
    const k = `${variant}:${Math.round(tx * 1024)}:${Math.round(ty * 1024)}:${z}:${rot}`;
    if (dedupe.has(k)) return;
    dedupe.add(k);
    out.push({
      tx,
      ty,
      variant,
      rot,
      pass: "ROAD_MARKINGS",
      key: keySuffix,
      zBase: z,
      zLogical: z,
    });
  };

  for (let bi = 0; bi < inputs.roadBands.length; bi++) {
    const band = inputs.roadBands[bi];
    const preset = resolveMarkingPresetForWidth(band.roadW);
    if (!preset.center && !preset.edge && !preset.divider) continue;
    const rot: 0 | 1 = band.orient === "H" ? 0 : 1;
    const perpX = band.orient === "H" ? 0 : 1;
    const perpY = band.orient === "H" ? 1 : 0;
    const yellowOffset = DOUBLE_LINE_OFFSET_TILES;
    const edgeOffset = (band.roadW * 0.5) - EDGE_LINE_INSET_TILES;
    const dividerOffset = (yellowOffset + edgeOffset) * 0.5;

    for (let i = 0; i < band.roadL; i++) {
      const sliceCenterX = band.orient === "H" ? (band.x0 + i + 0.5) : ((band.x0 + band.x1 + 1) * 0.5);
      const sliceCenterY = band.orient === "H" ? ((band.y0 + band.y1 + 1) * 0.5) : (band.y0 + i + 0.5);
      const suppressTx = Math.floor(sliceCenterX);
      const suppressTy = Math.floor(sliceCenterY);
      if (suppress(suppressTx, suppressTy)) continue;

      const sampleTx = band.orient === "H" ? (band.x0 + i) : (band.x0 + Math.floor((band.x1 - band.x0) * 0.5));
      const sampleTy = band.orient === "H" ? (band.y0 + Math.floor((band.y1 - band.y0) * 0.5)) : (band.y0 + i);
      if (!inBounds(sampleTx, sampleTy)) continue;

      if (preset.center) {
        push(
          sliceCenterX - yellowOffset * perpX,
          sliceCenterY - yellowOffset * perpY,
          ROAD_CENTER_MARKING_VARIANT_INDEX,
          rot,
          `center_${bi}_${i}_0`,
          sampleTx,
          sampleTy,
        );
        push(
          sliceCenterX + yellowOffset * perpX,
          sliceCenterY + yellowOffset * perpY,
          ROAD_CENTER_MARKING_VARIANT_INDEX,
          rot,
          `center_${bi}_${i}_1`,
          sampleTx,
          sampleTy,
        );
      }

      const emitEdge = (offset: number, edgeIndex: number) => {
        const tx = sliceCenterX + (perpX * offset);
        const ty = sliceCenterY + (perpY * offset);
        const z = inputs.getTileZAt(sampleTx, sampleTy);
        const dbgKey = `${z}:${Math.round(tx * 1024)}:${Math.round(ty * 1024)}:${rot}`;
        if (edgeSeen.has(dbgKey)) return;
        edgeSeen.add(dbgKey);
        push(tx, ty, edgeVariant, rot, `edge_${bi}_${i}_${edgeIndex}`, sampleTx, sampleTy);
      };
      if (preset.edge) {
        emitEdge(edgeOffset, 0);
        emitEdge(-edgeOffset, 1);
      }

      if (preset.divider) {
        push(
          sliceCenterX + (perpX * dividerOffset),
          sliceCenterY + (perpY * dividerOffset),
          dividerVariant,
          rot,
          `divider_${bi}_${i}_0`,
          sampleTx,
          sampleTy,
        );
        push(
          sliceCenterX - (perpX * dividerOffset),
          sliceCenterY - (perpY * dividerOffset),
          dividerVariant,
          rot,
          `divider_${bi}_${i}_1`,
          sampleTx,
          sampleTy,
        );
      }
    }
  }

  return out;
}
