import type { RenderCommand } from "../contracts/renderCommands";
import { ZONE_KIND } from "../../../factories/zoneFactory";
import { getRenderCapabilityEntry, renderCapabilityKey } from "./renderCapabilityMatrix";

export type RenderBackendId = "canvas2d" | "webgl";
export type RenderCommandBackend = "webgl" | "canvas2d" | "unsupported";

export type BackendFamilyCounts = Record<string, number>;
export type BackendKindCounts = Record<string, number>;

export type RenderBackendStats = {
  selectedBackend: RenderBackendId;
  webglCommandCount: number;
  canvasFallbackCommandCount: number;
  unsupportedCommandCount: number;
  webglGroundCommandCount: number;
  unsupportedGroundCommandCount: number;
  unsupportedVariants: string[];
  webglByFamily: BackendFamilyCounts;
  canvasFallbackByFamily: BackendFamilyCounts;
  unsupportedByFamily: BackendFamilyCounts;
  unsupportedByKind: BackendKindCounts;
  partiallyHandledFamilies: string[];
};

function hasFiniteRect(data: Record<string, unknown>): boolean {
  return Number.isFinite(Number(data.dx))
    && Number.isFinite(Number(data.dy))
    && Number.isFinite(Number(data.dw))
    && Number.isFinite(Number(data.dh));
}

function hasTriangleGeometry(data: Record<string, unknown>): boolean {
  return !!data.image
    && Number(data.sourceWidth) > 0
    && Number(data.sourceHeight) > 0
    && Array.isArray(data.finalVisibleTriangles)
    && data.finalVisibleTriangles.length > 0;
}

function incrementCount(record: BackendFamilyCounts, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function noteRenderBackendFamilyPlacement(
  stats: RenderBackendStats,
  family: string,
  backend: RenderCommandBackend,
): void {
  if (backend === "webgl") incrementCount(stats.webglByFamily, family);
  else if (backend === "canvas2d") incrementCount(stats.canvasFallbackByFamily, family);
  else incrementCount(stats.unsupportedByFamily, family);

  const placements = Number((stats.webglByFamily[family] ?? 0) > 0)
    + Number((stats.canvasFallbackByFamily[family] ?? 0) > 0)
    + Number((stats.unsupportedByFamily[family] ?? 0) > 0);
  if (placements > 1 && !stats.partiallyHandledFamilies.includes(family)) {
    stats.partiallyHandledFamilies.push(family);
  }
}

export function classifyCommandBackend(command: RenderCommand): RenderCommandBackend {
  const data = command.data as Record<string, unknown>;
  const capability = getRenderCapabilityEntry(command);
  if (
    capability.status === "DEFER_STAGE_D"
    || capability.status === "DEFER_STAGE_E"
    || capability.status === "CANVAS_FALLBACK"
  ) {
    return "canvas2d";
  }

  if (command.kind === "sprite" && data.variant === "imageSprite") {
    if (data.image && hasFiniteRect(data)) return "webgl";
    return "unsupported";
  }

  if (command.kind === "primitive" && data.variant === "zoneEffect") {
    const zoneKind = Number(data.zoneKind);
    return zoneKind === ZONE_KIND.FIRE ? "canvas2d" : "webgl";
  }

  if (command.kind === "sprite" && data.variant === "renderPieceSprite") {
    const draw = (data.draw ?? null) as Record<string, unknown> | null;
    if (draw?.img && hasFiniteRect(draw)) return "webgl";
    return "unsupported";
  }

  if (command.kind === "overlay" && data.variant === "structureOverlay") {
    const draw = ((data.piece ?? null) as Record<string, unknown> | null)?.draw as Record<string, unknown> | null;
    if (draw?.img && hasFiniteRect(draw)) return "webgl";
    return "unsupported";
  }

  if (command.kind === "triangle" && data.variant === "structureTriangleGroup") {
    const hasCompareDistanceDebug = Array.isArray(data.compareDistanceOnlyStableIds)
      && data.compareDistanceOnlyStableIds.length > 0;
    if (hasCompareDistanceDebug) return "canvas2d";
    const image = data.image;
    const drawWidth = Number(data.drawWidth);
    const drawHeight = Number(data.drawHeight);
    const triangles = data.finalVisibleTriangles;
    if (image && drawWidth > 0 && drawHeight > 0 && Array.isArray(triangles) && triangles.length > 0) {
      return "webgl";
    }
    return "unsupported";
  }

  if (command.kind === "overlay" && (data.variant === "screenTint" || data.variant === "ambientDarkness")) {
    return "webgl";
  }

  if (command.kind === "overlay" && data.variant === "sweepShadowMap") {
    return "canvas2d";
  }

  if (command.kind === "light" && data.variant === "projectedLight") {
    return "webgl";
  }

  if (command.kind === "decal" && data.variant === "imageTop") {
    if (data.mode === "flat" && data.image && hasFiniteRect(data)) return "webgl";
    if (data.mode === "oceanProjected" && hasTriangleGeometry(data)) return "webgl";
    return "canvas2d";
  }

  if (command.kind === "decal" && (data.variant === "runtimeSidewalkTop" || data.variant === "runtimeDecalTop")) {
    if (data.mode === "flat" && data.image && hasFiniteRect(data)) return "webgl";
    if (data.mode === "projected" && hasTriangleGeometry(data)) return "webgl";
    return "canvas2d";
  }

  switch (command.kind) {
    case "primitive":
    case "light":
    case "overlay":
    case "triangle":
    case "debug":
      return "canvas2d";
    case "sprite":
    case "decal":
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
    unsupportedVariants: [],
    webglByFamily: {},
    canvasFallbackByFamily: {},
    unsupportedByFamily: {},
    unsupportedByKind: {},
    partiallyHandledFamilies: [],
  };
}

export function commandFamilyKey(command: Pick<RenderCommand, "kind" | "data">): string {
  return renderCapabilityKey(command);
}
