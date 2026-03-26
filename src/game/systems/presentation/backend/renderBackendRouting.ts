import type { RenderCommand } from "../contracts/renderCommands";
import {
  commandAxesKey,
  classifyCommandBackend,
  createRenderBackendStats,
  noteRenderBackendFamilyPlacement,
  type RenderBackendStats,
} from "./renderBackendCapabilities";

export type RenderCommandSegment = {
  backend: "webgl" | "canvas2d";
  commands: RenderCommand[];
};

export function buildBackendSegments(
  commands: readonly RenderCommand[],
  stats: RenderBackendStats,
): RenderCommandSegment[] {
  const segments: RenderCommandSegment[] = [];

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const axesKey = commandAxesKey(command);
    const backend = classifyCommandBackend(command);
    if (backend === "unsupported") {
      stats.unsupportedCommandCount += 1;
      if (!stats.unsupportedCommandKeys.includes(axesKey)) stats.unsupportedCommandKeys.push(axesKey);
      stats.unsupportedBySemanticFamily[command.semanticFamily] = (stats.unsupportedBySemanticFamily[command.semanticFamily] ?? 0) + 1;
      noteRenderBackendFamilyPlacement(stats, axesKey, backend);
      continue;
    }
    if (backend === "webgl") stats.webglCommandCount += 1;
    else stats.canvasFallbackCommandCount += 1;
    noteRenderBackendFamilyPlacement(stats, axesKey, backend);

    const last = segments[segments.length - 1];
    if (last && last.backend === backend) {
      last.commands.push(command);
      continue;
    }
    segments.push({
      backend,
      commands: [command],
    });
  }

  return segments;
}

export function buildPureWebGLCommandList(
  commands: readonly RenderCommand[],
  stats: RenderBackendStats,
): RenderCommand[] {
  const supported: RenderCommand[] = [];

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const axesKey = commandAxesKey(command);
    const backend = classifyCommandBackend(command);
    if (backend === "webgl") {
      stats.webglCommandCount += 1;
      if (command.pass === "GROUND") stats.webglGroundCommandCount += 1;
      noteRenderBackendFamilyPlacement(stats, axesKey, "webgl");
      supported.push(command);
      continue;
    }

    stats.unsupportedCommandCount += 1;
    if (command.pass === "GROUND") stats.unsupportedGroundCommandCount += 1;
    if (!stats.unsupportedCommandKeys.includes(axesKey)) stats.unsupportedCommandKeys.push(axesKey);
    stats.unsupportedBySemanticFamily[command.semanticFamily] = (stats.unsupportedBySemanticFamily[command.semanticFamily] ?? 0) + 1;
    noteRenderBackendFamilyPlacement(stats, axesKey, "unsupported");
  }

  return supported;
}

export function createBackendStats(selectedBackend: "canvas2d" | "webgl"): RenderBackendStats {
  return createRenderBackendStats(selectedBackend);
}
