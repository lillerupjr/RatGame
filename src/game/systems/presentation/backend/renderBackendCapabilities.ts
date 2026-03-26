import { renderCommandAxesKey, type RenderCommand } from "../contracts/renderCommands";
import { ZONE_KIND } from "../../../factories/zoneFactory";
import { getRenderCapabilityEntry } from "./renderCapabilityMatrix";

export type RenderBackendId = "canvas2d" | "webgl";
export type RenderCommandBackend = "webgl" | "canvas2d" | "unsupported";

export type BackendFamilyCounts = Record<string, number>;
export type BackendSemanticFamilyCounts = Record<string, number>;

export type RenderBackendStats = {
  selectedBackend: RenderBackendId;
  webglCommandCount: number;
  canvasFallbackCommandCount: number;
  unsupportedCommandCount: number;
  webglGroundCommandCount: number;
  unsupportedGroundCommandCount: number;
  unsupportedCommandKeys: string[];
  webglByAxes: BackendFamilyCounts;
  canvasFallbackByAxes: BackendFamilyCounts;
  unsupportedByAxes: BackendFamilyCounts;
  unsupportedBySemanticFamily: BackendSemanticFamilyCounts;
  partiallyHandledAxes: string[];
};

function hasTriangleGeometry(data: Record<string, unknown>): boolean {
  return !!data.image
    && Number(data.sourceWidth) > 0
    && Number(data.sourceHeight) > 0
    && Array.isArray(data.triangles)
    && data.triangles.length > 0;
}

function incrementCount(record: BackendFamilyCounts, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function noteRenderBackendFamilyPlacement(
  stats: RenderBackendStats,
  axesKey: string,
  backend: RenderCommandBackend,
): void {
  if (backend === "webgl") incrementCount(stats.webglByAxes, axesKey);
  else if (backend === "canvas2d") incrementCount(stats.canvasFallbackByAxes, axesKey);
  else incrementCount(stats.unsupportedByAxes, axesKey);

  const placements = Number((stats.webglByAxes[axesKey] ?? 0) > 0)
    + Number((stats.canvasFallbackByAxes[axesKey] ?? 0) > 0)
    + Number((stats.unsupportedByAxes[axesKey] ?? 0) > 0);
  if (placements > 1 && !stats.partiallyHandledAxes.includes(axesKey)) {
    stats.partiallyHandledAxes.push(axesKey);
  }
}

export function classifyCommandBackend(command: RenderCommand): RenderCommandBackend {
  const payload = command.payload as Record<string, unknown>;
  const capability = getRenderCapabilityEntry(command);
  if (
    capability.status === "DEFER_STAGE_D"
    || capability.status === "DEFER_STAGE_E"
    || capability.status === "CANVAS_FALLBACK"
  ) {
    return "canvas2d";
  }

  switch (command.semanticFamily) {
    case "worldSprite": {
      const draw = (payload.draw ?? null) as Record<string, unknown> | null;
      if (
        payload.image
        && Number.isFinite(Number(payload.dx))
        && Number.isFinite(Number(payload.dy))
        && Number.isFinite(Number(payload.dw))
        && Number.isFinite(Number(payload.dh))
      ) {
        return "webgl";
      }
      if (
        draw?.img
        && Number.isFinite(Number(draw.dx))
        && Number.isFinite(Number(draw.dy))
        && Number.isFinite(Number(draw.dw))
        && Number.isFinite(Number(draw.dh))
      ) {
        return "webgl";
      }
      return "unsupported";
    }
    case "groundSurface":
      return hasTriangleGeometry(payload) ? "webgl" : "unsupported";
    case "groundDecal":
      return hasTriangleGeometry(payload) ? "webgl" : "unsupported";
    case "worldGeometry":
      return hasTriangleGeometry(payload) ? "webgl" : "unsupported";
    case "worldPrimitive":
      if (payload.lightPiece) return "webgl";
      if (Number.isFinite(Number(payload.zoneKind))) {
        return Number(payload.zoneKind) === ZONE_KIND.FIRE ? "canvas2d" : "webgl";
      }
      return "canvas2d";
    case "screenOverlay":
      if (command.finalForm === "quad") return "webgl";
      if (
        payload.darknessAlpha !== undefined
        || payload.ambientTint !== undefined
        || payload.ambientTintStrength !== undefined
      ) {
        return "webgl";
      }
      return "canvas2d";
    case "debug":
      return "canvas2d";
    default:
      return "unsupported";
  }
}

export function createRenderBackendStats(selectedBackend: RenderBackendId): RenderBackendStats {
  return {
    selectedBackend,
    webglCommandCount: 0,
    canvasFallbackCommandCount: 0,
    unsupportedCommandCount: 0,
    webglGroundCommandCount: 0,
    unsupportedGroundCommandCount: 0,
    unsupportedCommandKeys: [],
    webglByAxes: {},
    canvasFallbackByAxes: {},
    unsupportedByAxes: {},
    unsupportedBySemanticFamily: {},
    partiallyHandledAxes: [],
  };
}

export function commandAxesKey(command: Pick<RenderCommand, "semanticFamily" | "finalForm">): string {
  return renderCommandAxesKey(command);
}
