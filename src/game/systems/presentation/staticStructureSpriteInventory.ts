import {
  facePieceLayers,
  facePiecesInViewForLayer,
  occluderLayers,
  occludersInViewForLayer,
  overlaysInView,
} from "../../map/compile/kenneyMap";
import { mapWideOverlayViewRect } from "../../structures/monolithicStructureGeometry";

type CompiledMapShape = {
  originTx: number;
  originTy: number;
  width: number;
  height: number;
};

export function buildUniqueStaticStructureSpriteIds(compiledMap: CompiledMapShape): string[] {
  const viewRect = mapWideOverlayViewRect(compiledMap as any);
  const unique = new Set<string>();

  const overlays = overlaysInView(viewRect);
  for (let i = 0; i < overlays.length; i++) {
    const spriteId = String(overlays[i].spriteId ?? "");
    if (!spriteId) continue;
    unique.add(spriteId);
  }

  const faceLayers = facePieceLayers();
  for (let li = 0; li < faceLayers.length; li++) {
    const pieces = facePiecesInViewForLayer(faceLayers[li], viewRect);
    for (let i = 0; i < pieces.length; i++) {
      const spriteId = String(pieces[i].spriteId ?? "");
      if (!spriteId) continue;
      unique.add(spriteId);
    }
  }

  const wallLayers = occluderLayers();
  for (let li = 0; li < wallLayers.length; li++) {
    const pieces = occludersInViewForLayer(wallLayers[li], viewRect);
    for (let i = 0; i < pieces.length; i++) {
      const spriteId = String(pieces[i].spriteId ?? "");
      if (!spriteId) continue;
      unique.add(spriteId);
    }
  }

  return Array.from(unique).sort();
}
