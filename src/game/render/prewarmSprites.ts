import type { World } from "../../engine/world/world";
import type { CompiledKenneyMap } from "../map/compile/kenneyMapLoader";
import { getActiveMap } from "../map/compile/kenneyMap";

function isPrewarmableSpriteId(spriteId: string): boolean {
  const id = spriteId.trim().replace(/\.png$/i, "");
  if (
    id === "tiles/floor/decals/sidewalk_2"
    || id === "tiles/walls/sidewalk_s"
    || id === "tiles/walls/sidewalk_e"
  ) {
    return false;
  }
  return id.startsWith("tiles/")
    || id.startsWith("structures/")
    || id.startsWith("props/")
    || id.startsWith("entities/")
    || id.startsWith("loot/")
    || id.startsWith("vfx/");
}

/**
 * Build a conservative list of runtime sprite ids to prewarm for a floor/map.
 * Goal: reduce first-frame palette hitching without scanning the entire universe.
 *
 * Strategy:
 * - Prewarm currently active compiled map's visible-ish sprite ids:
 *   - floor tiles used in surfaces
 *   - decals currently in map
 *   - structure sprites used by overlays/structures
 *
 * This intentionally stays conservative; expand later if needed.
 */
export function collectRuntimeSpriteIdsToPrewarm(
  _w: World,
  activeMap?: CompiledKenneyMap | null,
): string[] {
  const map = activeMap ?? getActiveMap();
  if (!map) return [];

  const out: string[] = [];
  const anyMap = map as any;

  // Surfaces (tops): authored top sprite or runtime top sprite
  if (anyMap.surfacesByKey instanceof Map) {
    for (const list of anyMap.surfacesByKey.values() as Iterable<any>) {
      if (!Array.isArray(list)) continue;
      for (const s of list) {
        if (!s) continue;
        if (typeof s.spriteIdTop === "string") out.push(s.spriteIdTop);
        if (s.runtimeTop && typeof s.runtimeTop.spriteId === "string") out.push(s.runtimeTop.spriteId);
      }
    }
  }

  // Decals
  if (Array.isArray(anyMap.decals)) {
    for (const d of anyMap.decals) {
      if (d && typeof d.spriteId === "string") out.push(d.spriteId);
    }
  }

  // Overlays / stamp overlays
  if (Array.isArray(anyMap.overlays)) {
    for (const o of anyMap.overlays) {
      if (o && typeof o.spriteId === "string") out.push(o.spriteId);
    }
  }

  // Structure pieces sometimes store spriteId directly
  if (Array.isArray(anyMap.structures)) {
    for (const s of anyMap.structures) {
      if (s && typeof s.spriteId === "string") out.push(s.spriteId);
    }
  }

  // Generic: if map has a renderPieces list anywhere, grab spriteId fields
  if (Array.isArray(anyMap.renderPieces)) {
    for (const p of anyMap.renderPieces) {
      if (p && typeof p.spriteId === "string") out.push(p.spriteId);
    }
  }

  // Face pieces by layer (structures/walls/aprons in compiled map)
  if (anyMap.facePiecesByLayer instanceof Map) {
    for (const pieces of anyMap.facePiecesByLayer.values() as Iterable<any>) {
      if (!Array.isArray(pieces)) continue;
      for (const p of pieces) {
        if (p && typeof p.spriteId === "string") out.push(p.spriteId);
      }
    }
  }

  // Last pass: normalize (remove .png if present; de-dupe later by caller).
  return out
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.toLowerCase().endsWith(".png") ? s.slice(0, -4) : s))
    .filter(isPrewarmableSpriteId);
}
