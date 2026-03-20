import { resolveDebugFlags } from "../../../../debugSettings";
import type { DebugSettings } from "../../../../userSettings";
import type { RenderDebugFlags } from "./debugRenderTypes";

export function resolveRenderDebugFlags(debug: DebugSettings): RenderDebugFlags {
  const baseFlags = resolveDebugFlags(debug);
  return {
    showGrid: baseFlags.showGrid,
    showEntityAnchorOverlay: debug.entityAnchorOverlay,
    showWalkMask: baseFlags.showWalkMask,
    showRamps: baseFlags.showRamps,
    showOccluders: baseFlags.showOccluders,
    showDecals: baseFlags.showDecals,
    showProjectileFaces: baseFlags.showProjectileFaces,
    showTriggers: baseFlags.showTriggers,
    showRoadSemantic: baseFlags.showRoadSemantic,
    showStructureHeights: baseFlags.showStructureHeights,
    showStructureCollision: baseFlags.showStructureCollision,
    showStructureSlices: baseFlags.showStructureSlices,
    showStructureTriangleFootprint: baseFlags.showStructureTriangleFootprint,
    showEnemyAimOverlay: baseFlags.showEnemyAimOverlay,
    showLootGoblinOverlay: baseFlags.showLootGoblinOverlay,
    showMapOverlays: baseFlags.showMapOverlays,
    showZoneObjectiveBounds: !!debug.objectives?.showZoneBounds,
    shadowV1DebugGeometryMode: debug.shadowV1DebugGeometryMode,
    shadowCasterMode: debug.shadowCasterMode,
    shadowHybridDiagnosticMode: debug.shadowHybridDiagnosticMode,
    shadowDebugMode: debug.shadowDebugMode,
    shadowV5DebugView: debug.shadowV5DebugView,
    shadowV5TransformDebugMode: debug.shadowV5TransformDebugMode,
    shadowV6RequestedSemanticBucket: debug.shadowV6SemanticBucket,
    shadowV6PrimarySemanticBucket: "EAST_WEST",
    shadowV6SecondarySemanticBucket: "SOUTH_NORTH",
    shadowV6TopSemanticBucket: "TOP",
    shadowV6StructureIndex: debug.shadowV6StructureIndex,
    shadowV6SliceCount: debug.shadowV6SliceCount,
    shadowV6AllStructures: debug.shadowV6AllStructures,
    shadowV6OneStructureOnly: debug.shadowV6OneStructureOnly,
    shadowV6VerticalOnly: debug.shadowV6VerticalOnly,
    shadowV6TopOnly: debug.shadowV6TopOnly,
    shadowV6ForceRefresh: debug.shadowV6ForceRefresh,
    shadowV6FaceSliceDebugOverlay: debug.shadowV6FaceSliceDebugOverlay,
    shadowSunTimeHour: debug.shadowSunTimeHour,
  };
}
