import type { DebugSettings } from "../../../../userSettings";
import { resolveRenderDebugFlags } from "./debugRenderFlags";
import type { RenderDebugFrameContext } from "./debugRenderTypes";

function computeDebugPassEnabled(debug: DebugSettings): boolean {
  return (
    debug.entityAnchorOverlay
    || debug.walkMask
    || debug.ramps
    || debug.occluders
    || debug.decals
    || debug.projectileFaces
    || debug.triggers
    || debug.debugRoadSemantic
    || debug.structureHeights
    || debug.blockedTiles
    || debug.colliders
    || debug.slices
    || debug.spriteBounds
    || debug.showStructureSlices
    || debug.structureTriangleFootprint
    || debug.showStructureAnchors
    || debug.showStructureTriangleOwnershipSort
    || debug.enemyAimOverlay
    || debug.lootGoblinOverlay
    || debug.sweepShadowDebug
    || debug.tileHeightMap
  );
}

export function buildDebugFrameContext(debug: DebugSettings): RenderDebugFrameContext {
  return {
    enabled: computeDebugPassEnabled(debug),
    flags: resolveRenderDebugFlags(debug),
  };
}
