import { renderCommandAxesKey, type RenderCommand } from "../contracts/renderCommands";

export type RenderCapabilityStatus =
  | "WEBGL_READY"
  | "WEBGL_PORT_NEXT"
  | "CANVAS_FALLBACK"
  | "DEFER_STAGE_D"
  | "DEFER_STAGE_E";

export type RenderCapabilityEntry = {
  key: string;
  status: RenderCapabilityStatus;
  notes?: string;
};

const CAPABILITY_MATRIX: Record<string, RenderCapabilityEntry> = {
  "worldSprite:quad": {
    key: "worldSprite:quad",
    status: "WEBGL_READY",
    notes: "Canonical sprite quads are WebGL-ready; descriptor-based sprite fallbacks still route by payload shape.",
  },
  "groundSurface:quad": {
    key: "groundSurface:quad",
    status: "WEBGL_READY",
    notes: "Ground surfaces now emit quad-native payloads with explicit four-corner geometry.",
  },
  "groundDecal:quad": {
    key: "groundDecal:quad",
    status: "WEBGL_READY",
    notes: "Ground decals now emit quad-native payloads with explicit four-corner geometry.",
  },
  "worldPrimitive:primitive": {
    key: "worldPrimitive:primitive",
    status: "WEBGL_READY",
    notes: "Primitive routing now keys off canonical axes; exact backend support still depends on explicit payload content.",
  },
  "screenOverlay:quad": {
    key: "screenOverlay:quad",
    status: "WEBGL_READY",
    notes: "Screen-space quads are fully canonical.",
  },
  "screenOverlay:primitive": {
    key: "screenOverlay:primitive",
    status: "WEBGL_READY",
    notes: "Canonical screen primitives exist; floating-text remains payload-routed to Canvas for now.",
  },
  "debug:primitive": {
    key: "debug:primitive",
    status: "DEFER_STAGE_E",
    notes: "Debug families stay Canvas-backed unless needed for parity validation.",
  },
};

export function getRenderCapabilityMatrix(): Readonly<Record<string, RenderCapabilityEntry>> {
  return CAPABILITY_MATRIX;
}

export function renderCapabilityKey(command: Pick<RenderCommand, "semanticFamily" | "finalForm">): string {
  return renderCommandAxesKey(command);
}

export function getRenderCapabilityEntry(command: Pick<RenderCommand, "semanticFamily" | "finalForm">): RenderCapabilityEntry {
  return CAPABILITY_MATRIX[renderCapabilityKey(command)] ?? {
    key: renderCapabilityKey(command),
    status: "CANVAS_FALLBACK",
    notes: "Canonical family/form is unlisted; keep explicit Canvas fallback until classified.",
  };
}
