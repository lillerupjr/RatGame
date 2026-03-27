import type { RenderCommand } from "../contracts/renderCommands";
import { classifyCommandBackend } from "../backend/renderBackendCapabilities";

export type WorldBatchBreakReason =
  | "compatible continuation"
  | "render family changed"
  | "primitive type changed"
  | "shader/material changed"
  | "texture changed"
  | "blend mode changed"
  | "unsupported/fallback path changed"
  | "non-batchable path"
  | "other state incompatibility";

export type WorldBatchFamilySummary = {
  family: string;
  commands: number;
  batches: number;
  averageRunLength: number;
  maxRunLength: number;
  uniqueTextures: number;
  dominantBreakReason: WorldBatchBreakReason;
};

export type WorldBatchBoundarySample = {
  index: number;
  reason: WorldBatchBreakReason;
  previous: string;
  next: string;
};

export type WorldBatchAudit = {
  inspectedBackend: "canvas2d" | "webgl";
  compatibilityFields: readonly string[];
  totalWorldCommands: number;
  totalWorldBatches: number;
  averageRunLength: number;
  maxRunLength: number;
  compatibleContinuations: number;
  totalBatchBreaks: number;
  breakReasonCounts: Record<WorldBatchBreakReason, number>;
  familySummaries: WorldBatchFamilySummary[];
  sampleBoundaries: WorldBatchBoundarySample[];
};

type AuditDescriptor = {
  command: RenderCommand;
  reportFamily: string;
  primitiveKind: string;
  renderBackendPath: "webgl" | "canvas2d" | "unsupported";
  submissionKind: string;
  batchable: boolean;
  shaderMaterial: string;
  textureToken: string | null;
  blendMode: string | null;
  space: string | null;
  summary: string;
};

type MutableFamilySummary = {
  commands: number;
  batches: number;
  maxRunLength: number;
  currentRunLength: number;
  uniqueTextures: Set<string>;
  breakReasonCounts: Record<WorldBatchBreakReason, number>;
};

const BREAK_REASON_ORDER: readonly WorldBatchBreakReason[] = [
  "render family changed",
  "primitive type changed",
  "shader/material changed",
  "texture changed",
  "blend mode changed",
  "unsupported/fallback path changed",
  "non-batchable path",
  "other state incompatibility",
  "compatible continuation",
];

function makeZeroBreakReasonCounts(): Record<WorldBatchBreakReason, number> {
  return {
    "compatible continuation": 0,
    "render family changed": 0,
    "primitive type changed": 0,
    "shader/material changed": 0,
    "texture changed": 0,
    "blend mode changed": 0,
    "unsupported/fallback path changed": 0,
    "non-batchable path": 0,
    "other state incompatibility": 0,
  };
}

function dominantBreakReason(counts: Record<WorldBatchBreakReason, number>): WorldBatchBreakReason {
  let bestReason: WorldBatchBreakReason = "compatible continuation";
  let bestCount = -1;
  for (let i = 0; i < BREAK_REASON_ORDER.length; i++) {
    const reason = BREAK_REASON_ORDER[i];
    if (reason === "compatible continuation") continue;
    const count = counts[reason];
    if (count > bestCount) {
      bestCount = count;
      bestReason = reason;
    }
  }
  return bestCount > 0 ? bestReason : "compatible continuation";
}

function describeWorldFamily(command: RenderCommand): string {
  const payload = command.payload as Record<string, unknown>;
  if (command.semanticFamily === "worldSprite") {
    if (payload.draw) return "structures";
    if (payload.pickupIndex !== undefined) return "drops";
    if (
      payload.enemyIndex !== undefined
      || payload.npcIndex !== undefined
      || payload.neutralMobIndex !== undefined
    ) {
      return "entities";
    }
    if (payload.projectileIndex !== undefined) return "projectiles";
    if (payload.vfxIndex !== undefined) return "vfx";
    return "props";
  }
  if (command.semanticFamily === "worldGeometry") return "triangles";
  if (command.semanticFamily === "worldPrimitive") {
    if (payload.lightPiece) return "lights";
    if (payload.zoneKind !== undefined) return "zones";
    return "primitives";
  }
  return `${command.semanticFamily}:${command.finalForm}`;
}

function extractTextureSource(command: RenderCommand): object | null {
  const payload = command.payload as Record<string, unknown>;
  if (command.semanticFamily === "worldGeometry" && command.finalForm === "triangles") {
    return (payload.image ?? null) as object | null;
  }
  if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
    if (payload.image && typeof payload.image === "object") return payload.image as object;
    const draw = (payload.draw ?? null) as Record<string, unknown> | null;
    if (draw?.img && typeof draw.img === "object") return draw.img as object;
    return null;
  }
  return null;
}

function buildAuditDescriptor(
  command: RenderCommand,
  selectedBackend: "canvas2d" | "webgl",
  textureIds: WeakMap<object, number>,
  nextTextureId: { value: number },
): AuditDescriptor {
  const payload = command.payload as Record<string, unknown>;
  const reportFamily = describeWorldFamily(command);

  if (selectedBackend === "canvas2d") {
    const summary = `${reportFamily} ${command.semanticFamily}:${command.finalForm} canvas2d`;
    return {
      command,
      reportFamily,
      primitiveKind: command.finalForm,
      renderBackendPath: "canvas2d",
      submissionKind: "canvas2d",
      batchable: false,
      shaderMaterial: "canvas2d",
      textureToken: null,
      blendMode: null,
      space: null,
      summary,
    };
  }

  const backend = classifyCommandBackend(command);
  if (backend !== "webgl") {
    const summary = `${reportFamily} ${command.semanticFamily}:${command.finalForm} ${backend}`;
    return {
      command,
      reportFamily,
      primitiveKind: command.finalForm,
      renderBackendPath: backend,
      submissionKind: backend === "canvas2d" ? "canvasFallback" : "unsupported",
      batchable: false,
      shaderMaterial: backend === "canvas2d" ? "canvas2d" : "unsupported",
      textureToken: null,
      blendMode: null,
      space: null,
      summary,
    };
  }

  let submissionKind = `${command.semanticFamily}:${command.finalForm}`;
  let batchable = false;
  let shaderMaterial = submissionKind;
  let blendMode: string | null = null;
  let space: string | null = null;

  if (command.semanticFamily === "worldGeometry" && command.finalForm === "triangles") {
    submissionKind = "texturedTriangles";
    batchable = true;
    shaderMaterial = "textured";
    blendMode = "normal";
    space = "world";
  } else if (command.semanticFamily === "worldSprite" && command.finalForm === "quad") {
    submissionKind = "texturedTriangles";
    batchable = true;
    shaderMaterial = "textured";
    blendMode = payload.blendMode === "additive" ? "additive" : "normal";
    space = "world";
  } else if (command.semanticFamily === "worldPrimitive" && payload.lightPiece) {
    submissionKind = "projectedLight";
    shaderMaterial = "projectedLight";
    blendMode = "additive";
    space = "screen";
  } else if (command.semanticFamily === "worldPrimitive" && payload.zoneKind !== undefined) {
    submissionKind = "zoneEffect";
    shaderMaterial = "zoneEffect";
    blendMode = "normal";
    space = "world";
  }

  const textureSource = extractTextureSource(command);
  let textureToken: string | null = null;
  if (textureSource) {
    let textureId = textureIds.get(textureSource);
    if (!textureId) {
      textureId = nextTextureId.value++;
      textureIds.set(textureSource, textureId);
    }
    textureToken = `tex${textureId}`;
  }

  const summary = [
    reportFamily,
    `${command.semanticFamily}:${command.finalForm}`,
    submissionKind,
    textureToken ?? "tex-",
    blendMode ?? "blend-",
    space ?? "space-",
  ].join(" ");

  return {
    command,
    reportFamily,
    primitiveKind: command.finalForm,
    renderBackendPath: "webgl",
    submissionKind,
    batchable,
    shaderMaterial,
    textureToken,
    blendMode,
    space,
    summary,
  };
}

function classifyBreakReason(previous: AuditDescriptor, next: AuditDescriptor): WorldBatchBreakReason {
  if (previous.renderBackendPath !== next.renderBackendPath) {
    return "unsupported/fallback path changed";
  }

  const canContinueBatch = previous.batchable
    && next.batchable
    && previous.submissionKind === next.submissionKind
    && previous.shaderMaterial === next.shaderMaterial
    && previous.textureToken === next.textureToken
    && previous.blendMode === next.blendMode
    && previous.space === next.space;

  if (canContinueBatch) return "compatible continuation";

  if (previous.batchable && next.batchable) {
    if (previous.submissionKind !== next.submissionKind) return "primitive type changed";
    if (previous.shaderMaterial !== next.shaderMaterial) return "shader/material changed";
    if (previous.textureToken !== next.textureToken) return "texture changed";
    if (previous.blendMode !== next.blendMode) return "blend mode changed";
    if (previous.space !== next.space) return "other state incompatibility";
  }

  if (previous.command.semanticFamily !== next.command.semanticFamily) return "render family changed";
  if (previous.submissionKind !== next.submissionKind) return "primitive type changed";
  if (previous.shaderMaterial !== next.shaderMaterial) return "shader/material changed";
  if (previous.textureToken !== next.textureToken) return "texture changed";
  if (previous.blendMode !== next.blendMode) return "blend mode changed";
  if (previous.space !== next.space) return "other state incompatibility";
  if (!previous.batchable || !next.batchable) return "non-batchable path";
  return "other state incompatibility";
}

function ensureFamilySummary(
  summaries: Map<string, MutableFamilySummary>,
  family: string,
): MutableFamilySummary {
  let summary = summaries.get(family);
  if (!summary) {
    summary = {
      commands: 0,
      batches: 0,
      maxRunLength: 0,
      currentRunLength: 0,
      uniqueTextures: new Set<string>(),
      breakReasonCounts: makeZeroBreakReasonCounts(),
    };
    summaries.set(family, summary);
  }
  return summary;
}

export function analyzeWorldBatchStream(
  commands: readonly RenderCommand[],
  selectedBackend: "canvas2d" | "webgl",
): WorldBatchAudit {
  const worldCommands = commands.filter((command) => command.pass === "WORLD");
  const breakReasonCounts = makeZeroBreakReasonCounts();
  const familySummaries = new Map<string, MutableFamilySummary>();
  const sampleBoundaries: WorldBatchBoundarySample[] = [];
  const textureIds = new WeakMap<object, number>();
  const nextTextureId = { value: 1 };
  const descriptors = worldCommands.map((command) => buildAuditDescriptor(command, selectedBackend, textureIds, nextTextureId));

  let totalWorldBatches = 0;
  let maxRunLength = 0;
  let currentRunLength = 0;

  for (let i = 0; i < descriptors.length; i++) {
    const descriptor = descriptors[i];
    const familySummary = ensureFamilySummary(familySummaries, descriptor.reportFamily);
    familySummary.commands += 1;
    if (descriptor.textureToken) familySummary.uniqueTextures.add(descriptor.textureToken);

    let startsNewBatch = i === 0;
    let reason: WorldBatchBreakReason = "compatible continuation";
    if (i === 0) {
      totalWorldBatches += 1;
      currentRunLength = 1;
    } else {
      reason = classifyBreakReason(descriptors[i - 1], descriptor);
      breakReasonCounts[reason] += 1;
      if (reason === "compatible continuation") {
        currentRunLength += 1;
      } else {
        totalWorldBatches += 1;
        startsNewBatch = true;
        if (currentRunLength > maxRunLength) maxRunLength = currentRunLength;
        currentRunLength = 1;
        familySummary.breakReasonCounts[reason] += 1;
        if (sampleBoundaries.length < 5) {
          sampleBoundaries.push({
            index: i - 1,
            reason,
            previous: descriptors[i - 1].summary,
            next: descriptor.summary,
          });
        }
      }
    }

    if (startsNewBatch) familySummary.batches += 1;
    familySummary.currentRunLength = startsNewBatch ? 1 : familySummary.currentRunLength + 1;
    if (familySummary.currentRunLength > familySummary.maxRunLength) {
      familySummary.maxRunLength = familySummary.currentRunLength;
    }
    if (reason !== "compatible continuation" && i > 0 && descriptors[i - 1].reportFamily !== descriptor.reportFamily) {
      familySummary.currentRunLength = 1;
    }
  }

  if (currentRunLength > maxRunLength) maxRunLength = currentRunLength;

  const totalWorldCommands = descriptors.length;
  if (totalWorldCommands === 0) {
    return {
      inspectedBackend: selectedBackend,
      compatibilityFields: [
        "semanticFamily/finalForm",
        "texture identity",
        "shader/material lane",
        "blend mode",
        "render backend path",
      ],
      totalWorldCommands: 0,
      totalWorldBatches: 0,
      averageRunLength: 0,
      maxRunLength: 0,
      compatibleContinuations: 0,
      totalBatchBreaks: 0,
      breakReasonCounts,
      familySummaries: [],
      sampleBoundaries: [],
    };
  }

  const mutableFamilyEntries = Array.from(familySummaries.entries()).map(([family, summary]) => ({
    family,
    summary,
  }));

  const familySummaryList: WorldBatchFamilySummary[] = mutableFamilyEntries
    .map(({ family, summary }) => ({
      family,
      commands: summary.commands,
      batches: summary.batches,
      averageRunLength: summary.batches > 0 ? summary.commands / summary.batches : 0,
      maxRunLength: summary.maxRunLength,
      uniqueTextures: summary.uniqueTextures.size,
      dominantBreakReason: dominantBreakReason(summary.breakReasonCounts),
    }))
    .sort((a, b) => b.commands - a.commands || b.batches - a.batches || a.family.localeCompare(b.family));

  return {
    inspectedBackend: selectedBackend,
    compatibilityFields: [
      "semanticFamily/finalForm",
      "texture identity",
      "shader/material lane",
      "blend mode",
      "render backend path",
    ],
    totalWorldCommands,
    totalWorldBatches,
    averageRunLength: totalWorldBatches > 0 ? totalWorldCommands / totalWorldBatches : 0,
    maxRunLength,
    compatibleContinuations: breakReasonCounts["compatible continuation"],
    totalBatchBreaks: Math.max(0, totalWorldBatches - 1),
    breakReasonCounts,
    familySummaries: familySummaryList,
    sampleBoundaries,
  };
}
