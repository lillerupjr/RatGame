import type { RenderCommand } from "../contracts/renderCommands";

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
  "sprite:imageSprite": {
    key: "sprite:imageSprite",
    status: "WEBGL_READY",
    notes: "Stage B textured-quad path.",
  },
  "sprite:vfxClip": {
    key: "sprite:vfxClip",
    status: "CANVAS_FALLBACK",
    notes: "Legacy fallback when extractor cannot resolve a portable image frame.",
  },
  "sprite:pickup": {
    key: "sprite:pickup",
    status: "CANVAS_FALLBACK",
    notes: "Mixes sprite draws with fallback vector shapes and relight overlays.",
  },
  "sprite:enemy": {
    key: "sprite:enemy",
    status: "CANVAS_FALLBACK",
    notes: "Still resolves animation, relight overlays, and aura FX in Canvas.",
  },
  "sprite:npc": {
    key: "sprite:npc",
    status: "CANVAS_FALLBACK",
  },
  "sprite:neutralMob": {
    key: "sprite:neutralMob",
    status: "CANVAS_FALLBACK",
  },
  "sprite:projectileSpark": {
    key: "sprite:projectileSpark",
    status: "CANVAS_FALLBACK",
    notes: "Legacy fallback if the portable spark image is unavailable.",
  },
  "sprite:projectile": {
    key: "sprite:projectile",
    status: "CANVAS_FALLBACK",
    notes: "Still mixes sprite, shadow, and follower effects.",
  },
  "sprite:player": {
    key: "sprite:player",
    status: "CANVAS_FALLBACK",
  },
  "sprite:renderPieceSprite": {
    key: "sprite:renderPieceSprite",
    status: "WEBGL_READY",
    notes: "Pure textured quads only.",
  },
  "decal:runtimeSidewalkTop": {
    key: "decal:runtimeSidewalkTop",
    status: "WEBGL_PORT_NEXT",
    notes: "Needs ramp/runtime-top parity work.",
  },
  "decal:imageTop": {
    key: "decal:imageTop",
    status: "WEBGL_READY",
    notes: "Flat image tops are ready; projected ocean tops still fall back.",
  },
  "decal:runtimeDecalTop": {
    key: "decal:runtimeDecalTop",
    status: "WEBGL_PORT_NEXT",
    notes: "Needs runtime decal baking and ramp parity work.",
  },
  "primitive:zoneEffect": {
    key: "primitive:zoneEffect",
    status: "WEBGL_READY",
    notes: "AURA/telegraph/hazard pulse ellipses are ready; FIRE zones remain explicit Canvas fallback.",
  },
  "primitive:entityShadow": {
    key: "primitive:entityShadow",
    status: "DEFER_STAGE_E",
    notes: "Shadow migration stays deferred until after hard-geometry parity is settled.",
  },
  "primitive:playerBeam": {
    key: "primitive:playerBeam",
    status: "DEFER_STAGE_E",
    notes: "Path-style beam rendering remains Canvas-backed for now.",
  },
  "primitive:floatingText": {
    key: "primitive:floatingText",
    status: "DEFER_STAGE_E",
    notes: "Canvas text remains the parity path.",
  },
  "primitive:playerWedge": {
    key: "primitive:playerWedge",
    status: "DEFER_STAGE_E",
    notes: "Debug/path wedge rendering is not part of the Stage D geometry port.",
  },
  "overlay:zoneObjective": {
    key: "overlay:zoneObjective",
    status: "CANVAS_FALLBACK",
  },
  "overlay:structureOverlay": {
    key: "overlay:structureOverlay",
    status: "WEBGL_READY",
    notes: "Sprite-like structure pieces only; triangles remain deferred.",
  },
  "overlay:screenTint": {
    key: "overlay:screenTint",
    status: "WEBGL_READY",
  },
  "overlay:ambientDarkness": {
    key: "overlay:ambientDarkness",
    status: "WEBGL_READY",
  },
  "light:projectedLight": {
    key: "light:projectedLight",
    status: "WEBGL_READY",
    notes: "Projected additive tint pieces only; no lighting-system redesign.",
  },
  "triangle:structureTriangleGroup": {
    key: "triangle:structureTriangleGroup",
    status: "WEBGL_READY",
    notes: "Stage D textured-triangle path is live; compare-distance debug overlays still fall back explicitly.",
  },
  "debug:debugPass": {
    key: "debug:debugPass",
    status: "DEFER_STAGE_E",
    notes: "Debug families stay Canvas-backed unless needed for parity validation.",
  },
};

export function getRenderCapabilityMatrix(): Readonly<Record<string, RenderCapabilityEntry>> {
  return CAPABILITY_MATRIX;
}

export function renderCapabilityKey(command: Pick<RenderCommand, "kind" | "data">): string {
  return `${command.kind}:${command.data.variant}`;
}

export function getRenderCapabilityEntry(command: Pick<RenderCommand, "kind" | "data">): RenderCapabilityEntry {
  return CAPABILITY_MATRIX[renderCapabilityKey(command)] ?? {
    key: renderCapabilityKey(command),
    status: "CANVAS_FALLBACK",
    notes: "Variant is unlisted; keep explicit Canvas fallback until classified.",
  };
}
