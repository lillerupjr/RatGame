import type { RenderCommand } from "../contracts/renderCommands";
import { classifyCommandBackend } from "../backend/renderBackendCapabilities";
import { getTextureDebugLabel, isGroundChunkTextureSource, isStableTextureSource } from "../stableTextureSource";

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

export type WorldBatchTextureBreakCause = {
  label: string;
  count: number;
  previous: string;
  next: string;
};

export type WorldRunLengthAudit = {
  averageTextureRun: number;
  maxTextureRun: number;
  averageCompatibleRun: number;
  maxCompatibleRun: number;
};

export type WorldReorderProbe = {
  windowSize: 4 | 8 | 16;
  totalWorldBatches: number;
  averageRunLength: number;
  totalBatchBreaks: number;
  textureBreaks: number;
  renderFamilyBreaks: number;
  riskCount: number;
  overlapRiskCount: number;
  feetSortYRiskCount: number;
  groupBoundaryRiskCount: number;
};

export type WorldBatchAudit = {
  inspectedBackend: "canvas2d" | "webgl";
  compatibilityFields: readonly string[];
  totalWorldCommands: number;
  quadCommands: number;
  triangleCommands: number;
  batchableCommands: number;
  texturedCommands: number;
  uniqueTextures: number;
  totalWorldBatches: number;
  averageRunLength: number;
  maxRunLength: number;
  compatibleContinuations: number;
  totalBatchBreaks: number;
  breakReasonCounts: Record<WorldBatchBreakReason, number>;
  familySummaries: WorldBatchFamilySummary[];
  sampleBoundaries: WorldBatchBoundarySample[];
  topTextureBreakCauses?: WorldBatchTextureBreakCause[];
  runLengths: WorldRunLengthAudit;
  reorderProbes: WorldReorderProbe[];
};

type AuditBounds = { minX: number; minY: number; maxX: number; maxY: number } | null;

type AuditDescriptor = {
  command: RenderCommand;
  originalIndex: number;
  reportFamily: string;
  primitiveKind: string;
  renderBackendPath: "webgl" | "canvas2d" | "unsupported";
  submissionKind: string;
  batchable: boolean;
  shaderMaterial: string;
  textureToken: string | null;
  textureLabel: string | null;
  blendMode: string | null;
  space: string | null;
  ownerGroupToken: string;
  bounds: AuditBounds;
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

type SequenceStats = {
  totalWorldBatches: number;
  averageRunLength: number;
  maxRunLength: number;
  compatibleContinuations: number;
  totalBatchBreaks: number;
  breakReasonCounts: Record<WorldBatchBreakReason, number>;
  sampleBoundaries: WorldBatchBoundarySample[];
  topTextureBreakCauses: WorldBatchTextureBreakCause[];
  familySummaries: WorldBatchFamilySummary[];
  runLengths: WorldRunLengthAudit;
};

const REORDER_PROBE_WINDOWS: readonly (4 | 8 | 16)[] = [4, 8, 16];

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
    if (payload.auditFamily === "structures") return "structures";
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
  if (command.semanticFamily === "worldPrimitive") {
    if (payload.zoneKind !== undefined) return "zones";
    return "primitives";
  }
  return `${command.semanticFamily}:${command.finalForm}`;
}

function extractTextureSource(command: RenderCommand): object | null {
  const payload = command.payload as Record<string, unknown>;
  if (
    (command.semanticFamily === "groundSurface"
      || command.semanticFamily === "groundDecal"
      || command.semanticFamily === "worldSprite")
    && command.finalForm === "quad"
  ) {
    if (payload.image && typeof payload.image === "object") return payload.image as object;
    const draw = (payload.draw ?? null) as Record<string, unknown> | null;
    if (draw?.img && typeof draw.img === "object") return draw.img as object;
    return null;
  }
  return null;
}

function buildBounds(command: RenderCommand): AuditBounds {
  const payload = command.payload as Record<string, unknown>;
  if (command.finalForm === "quad" && (
    command.semanticFamily === "groundSurface"
    || command.semanticFamily === "groundDecal"
    || command.semanticFamily === "worldSprite"
  )) {
    const explicitPoints = [
      { x: Number(payload.x0), y: Number(payload.y0) },
      { x: Number(payload.x1), y: Number(payload.y1) },
      { x: Number(payload.x2), y: Number(payload.y2) },
      { x: Number(payload.x3), y: Number(payload.y3) },
    ];
    if (explicitPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const pt of explicitPoints) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
      return { minX, minY, maxX, maxY };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const dx = typeof payload.dx === "number" ? payload.dx : undefined;
    const dy = typeof payload.dy === "number" ? payload.dy : undefined;
    const dw = typeof payload.dw === "number" ? payload.dw : undefined;
    const dh = typeof payload.dh === "number" ? payload.dh : undefined;
    if (dx !== undefined && dy !== undefined && dw !== undefined && dh !== undefined) {
      return { minX: dx, minY: dy, maxX: dx + dw, maxY: dy + dh };
    }
    const draw = (payload.draw ?? null) as Record<string, unknown> | null;
    if (
      draw
      && typeof draw.dx === "number"
      && typeof draw.dy === "number"
      && typeof draw.dw === "number"
      && typeof draw.dh === "number"
    ) {
      return {
        minX: draw.dx,
        minY: draw.dy,
        maxX: draw.dx + draw.dw,
        maxY: draw.dy + draw.dh,
      };
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  }

  return null;
}

function overlaps(a: AuditBounds, b: AuditBounds): boolean {
  if (!a || !b) return false;
  return !(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY);
}

function compareBatchSignature(a: AuditDescriptor, b: AuditDescriptor): number {
  if (a.renderBackendPath !== b.renderBackendPath) return a.renderBackendPath.localeCompare(b.renderBackendPath);
  if (a.batchable !== b.batchable) return a.batchable ? -1 : 1;
  if (a.submissionKind !== b.submissionKind) return a.submissionKind.localeCompare(b.submissionKind);
  if (a.shaderMaterial !== b.shaderMaterial) return a.shaderMaterial.localeCompare(b.shaderMaterial);
  if ((a.textureToken ?? "") !== (b.textureToken ?? "")) return (a.textureToken ?? "").localeCompare(b.textureToken ?? "");
  if ((a.blendMode ?? "") !== (b.blendMode ?? "")) return (a.blendMode ?? "").localeCompare(b.blendMode ?? "");
  if ((a.space ?? "") !== (b.space ?? "")) return (a.space ?? "").localeCompare(b.space ?? "");
  return a.originalIndex - b.originalIndex;
}

function canContinueBatch(previous: AuditDescriptor, next: AuditDescriptor): boolean {
  return previous.batchable
    && next.batchable
    && previous.submissionKind === next.submissionKind
    && previous.shaderMaterial === next.shaderMaterial
    && previous.textureToken === next.textureToken
    && previous.blendMode === next.blendMode
    && previous.space === next.space;
}

function classifyBreakReason(previous: AuditDescriptor, next: AuditDescriptor): WorldBatchBreakReason {
  if (previous.renderBackendPath !== next.renderBackendPath) {
    return "unsupported/fallback path changed";
  }
  if (canContinueBatch(previous, next)) return "compatible continuation";

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

function basenameFromPath(value: string): string {
  const normalized = value.split("?")[0].split("#")[0];
  const slash = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function describeTextureSourceLabel(textureSource: object | null, textureToken: string | null): string | null {
  if (!textureSource) return textureToken;
  const flaggedLabel = getTextureDebugLabel(textureSource);
  if (flaggedLabel) return flaggedLabel;

  const anySource = textureSource as Record<string, unknown> & {
    getAttribute?: (name: string) => string | null;
    currentSrc?: string;
    src?: string;
    id?: string;
  };
  const attrLabel = typeof anySource.getAttribute === "function" ? anySource.getAttribute("data-label") : null;
  if (typeof attrLabel === "string" && attrLabel.trim()) return attrLabel;
  if (typeof anySource.id === "string" && anySource.id.trim()) return anySource.id;
  if (typeof anySource.currentSrc === "string" && anySource.currentSrc.trim()) {
    return basenameFromPath(anySource.currentSrc);
  }
  if (typeof anySource.src === "string" && anySource.src.trim()) {
    return basenameFromPath(anySource.src);
  }
  if (isGroundChunkTextureSource(textureSource)) return textureToken ? `groundChunk(${textureToken})` : "groundChunk";
  if (isStableTextureSource(textureSource)) return textureToken ? `stableCanvas(${textureToken})` : "stableCanvas";
  const ctor = (textureSource as { constructor?: { name?: string } }).constructor?.name;
  if (typeof ctor === "string" && ctor) return textureToken ? `${ctor}(${textureToken})` : ctor;
  return textureToken;
}

function formatTextureBreakTransition(previous: AuditDescriptor, next: AuditDescriptor): string {
  const previousLabel = previous.textureLabel ?? previous.textureToken ?? "tex-";
  const nextLabel = next.textureLabel ?? next.textureToken ?? "tex-";
  return `${previous.reportFamily}:${previousLabel} -> ${next.reportFamily}:${nextLabel}`;
}

function buildAuditDescriptor(
  command: RenderCommand,
  originalIndex: number,
  selectedBackend: "canvas2d" | "webgl",
  textureIds: WeakMap<object, number>,
  nextTextureId: { value: number },
): AuditDescriptor {
  const payload = command.payload as Record<string, unknown>;
  const reportFamily = describeWorldFamily(command);
  const ownerGroupToken = [
    command.key.slice,
    command.key.within,
    command.key.baseZ,
    command.key.kindOrder,
    command.key.structureSouthSlice ?? "",
    command.key.structureSouthWithin ?? "",
  ].join("|");

  if (selectedBackend === "canvas2d") {
    return {
      command,
      originalIndex,
      reportFamily,
      primitiveKind: command.finalForm,
      renderBackendPath: "canvas2d",
      submissionKind: "canvas2d",
      batchable: false,
      shaderMaterial: "canvas2d",
      textureToken: null,
      textureLabel: null,
      blendMode: null,
      space: null,
      ownerGroupToken,
      bounds: buildBounds(command),
      summary: `${reportFamily} ${command.semanticFamily}:${command.finalForm} canvas2d`,
    };
  }

  const backend = classifyCommandBackend(command);
  if (backend !== "webgl") {
    return {
      command,
      originalIndex,
      reportFamily,
      primitiveKind: command.finalForm,
      renderBackendPath: backend,
      submissionKind: backend === "canvas2d" ? "canvasFallback" : "unsupported",
      batchable: false,
      shaderMaterial: backend === "canvas2d" ? "canvas2d" : "unsupported",
      textureToken: null,
      textureLabel: null,
      blendMode: null,
      space: null,
      ownerGroupToken,
      bounds: buildBounds(command),
      summary: `${reportFamily} ${command.semanticFamily}:${command.finalForm} ${backend}`,
    };
  }

  let submissionKind = `${command.semanticFamily}:${command.finalForm}`;
  let batchable = false;
  let shaderMaterial = submissionKind;
  let blendMode: string | null = null;
  let space: string | null = null;

  if (
    (command.semanticFamily === "groundSurface"
      || command.semanticFamily === "groundDecal"
      || command.semanticFamily === "worldSprite")
    && command.finalForm === "quad"
  ) {
    submissionKind = "texturedTriangles";
    batchable = true;
    shaderMaterial = "textured";
    blendMode = payload.blendMode === "additive" ? "additive" : "normal";
    space = "world";
  } else if (command.semanticFamily === "worldPrimitive" && payload.zoneKind !== undefined) {
    submissionKind = "zoneEffect";
    shaderMaterial = "zoneEffect";
    blendMode = "normal";
    space = "world";
  }

  const textureSource = extractTextureSource(command);
  let textureToken: string | null = null;
  let textureLabel: string | null = null;
  if (textureSource) {
    let textureId = textureIds.get(textureSource);
    if (!textureId) {
      textureId = nextTextureId.value++;
      textureIds.set(textureSource, textureId);
    }
    textureToken = `tex${textureId}`;
    textureLabel = describeTextureSourceLabel(textureSource, textureToken);
  }

  return {
    command,
    originalIndex,
    reportFamily,
    primitiveKind: command.finalForm,
    renderBackendPath: "webgl",
    submissionKind,
    batchable,
    shaderMaterial,
    textureToken,
    textureLabel,
    blendMode,
    space,
    ownerGroupToken,
    bounds: buildBounds(command),
    summary: [
      reportFamily,
      `${command.semanticFamily}:${command.finalForm}`,
      submissionKind,
      textureToken ?? "tex-",
      blendMode ?? "blend-",
      space ?? "space-",
    ].join(" "),
  };
}

function analyzeRunLengths(descriptors: readonly AuditDescriptor[]): WorldRunLengthAudit {
  if (descriptors.length === 0) {
    return {
      averageTextureRun: 0,
      maxTextureRun: 0,
      averageCompatibleRun: 0,
      maxCompatibleRun: 0,
    };
  }

  let textureRunCount = 0;
  let textureRunSum = 0;
  let maxTextureRun = 0;
  let currentTextureRun = 1;

  let compatibleRunCount = 0;
  let compatibleRunSum = 0;
  let maxCompatibleRun = 0;
  let currentCompatibleRun = 1;

  for (let i = 1; i < descriptors.length; i++) {
    const previous = descriptors[i - 1];
    const next = descriptors[i];
    if (previous.textureToken !== null && previous.textureToken === next.textureToken) {
      currentTextureRun += 1;
    } else {
      textureRunCount += 1;
      textureRunSum += currentTextureRun;
      if (currentTextureRun > maxTextureRun) maxTextureRun = currentTextureRun;
      currentTextureRun = 1;
    }

    if (canContinueBatch(previous, next)) {
      currentCompatibleRun += 1;
    } else {
      compatibleRunCount += 1;
      compatibleRunSum += currentCompatibleRun;
      if (currentCompatibleRun > maxCompatibleRun) maxCompatibleRun = currentCompatibleRun;
      currentCompatibleRun = 1;
    }
  }

  textureRunCount += 1;
  textureRunSum += currentTextureRun;
  if (currentTextureRun > maxTextureRun) maxTextureRun = currentTextureRun;
  compatibleRunCount += 1;
  compatibleRunSum += currentCompatibleRun;
  if (currentCompatibleRun > maxCompatibleRun) maxCompatibleRun = currentCompatibleRun;

  return {
    averageTextureRun: textureRunCount > 0 ? textureRunSum / textureRunCount : 0,
    maxTextureRun,
    averageCompatibleRun: compatibleRunCount > 0 ? compatibleRunSum / compatibleRunCount : 0,
    maxCompatibleRun,
  };
}

function analyzeSequence(descriptors: readonly AuditDescriptor[]): SequenceStats {
  const breakReasonCounts = makeZeroBreakReasonCounts();
  const familySummaries = new Map<string, MutableFamilySummary>();
  const sampleBoundaries: WorldBatchBoundarySample[] = [];
  const textureBreakCauseCounts = new Map<string, WorldBatchTextureBreakCause>();

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
        if (reason === "texture changed") {
          const previousDescriptor = descriptors[i - 1];
          const label = formatTextureBreakTransition(previousDescriptor, descriptor);
          const existing = textureBreakCauseCounts.get(label);
          if (existing) {
            existing.count += 1;
          } else {
            textureBreakCauseCounts.set(label, {
              label,
              count: 1,
              previous: previousDescriptor.summary,
              next: descriptor.summary,
            });
          }
        }
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
  const familySummaryList: WorldBatchFamilySummary[] = Array.from(familySummaries.entries())
    .map(([family, summary]) => ({
      family,
      commands: summary.commands,
      batches: summary.batches,
      averageRunLength: summary.batches > 0 ? summary.commands / summary.batches : 0,
      maxRunLength: summary.maxRunLength,
      uniqueTextures: summary.uniqueTextures.size,
      dominantBreakReason: dominantBreakReason(summary.breakReasonCounts),
    }))
    .sort((a, b) => b.commands - a.commands || b.batches - a.batches || a.family.localeCompare(b.family));
  const topTextureBreakCauses = Array.from(textureBreakCauseCounts.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);

  return {
    totalWorldBatches,
    averageRunLength: totalWorldBatches > 0 ? totalWorldCommands / totalWorldBatches : 0,
    maxRunLength,
    compatibleContinuations: breakReasonCounts["compatible continuation"],
    totalBatchBreaks: Math.max(0, totalWorldBatches - 1),
    breakReasonCounts,
    familySummaries: familySummaryList,
    sampleBoundaries,
    topTextureBreakCauses,
    runLengths: analyzeRunLengths(descriptors),
  };
}

function buildReorderedDescriptors(descriptors: readonly AuditDescriptor[], windowSize: 4 | 8 | 16): AuditDescriptor[] {
  const reordered: AuditDescriptor[] = [];
  for (let start = 0; start < descriptors.length; start += windowSize) {
    const window = descriptors.slice(start, start + windowSize);
    reordered.push(...[...window].sort(compareBatchSignature));
  }
  return reordered;
}

function analyzeReorderRisk(
  original: readonly AuditDescriptor[],
  reordered: readonly AuditDescriptor[],
  windowSize: 4 | 8 | 16,
): Pick<WorldReorderProbe, "riskCount" | "overlapRiskCount" | "feetSortYRiskCount" | "groupBoundaryRiskCount"> {
  let riskCount = 0;
  let overlapRiskCount = 0;
  let feetSortYRiskCount = 0;
  let groupBoundaryRiskCount = 0;

  for (let start = 0; start < original.length; start += windowSize) {
    const originalWindow = original.slice(start, start + windowSize);
    const reorderedWindow = reordered.slice(start, start + windowSize);
    const reorderedPosition = new Map<number, number>();
    for (let i = 0; i < reorderedWindow.length; i++) {
      reorderedPosition.set(reorderedWindow[i].originalIndex, i);
    }

    for (let i = 0; i < originalWindow.length; i++) {
      for (let j = i + 1; j < originalWindow.length; j++) {
        const a = originalWindow[i];
        const b = originalWindow[j];
        const posA = reorderedPosition.get(a.originalIndex) ?? i;
        const posB = reorderedPosition.get(b.originalIndex) ?? j;
        if (posA < posB) continue;

        let risky = false;
        if (overlaps(a.bounds, b.bounds)) {
          overlapRiskCount += 1;
          risky = true;
        }
        if ((a.command.key.feetSortY ?? 0) !== (b.command.key.feetSortY ?? 0)) {
          feetSortYRiskCount += 1;
          risky = true;
        }
        if (a.ownerGroupToken !== b.ownerGroupToken) {
          groupBoundaryRiskCount += 1;
          risky = true;
        }
        if (risky) riskCount += 1;
      }
    }
  }

  return {
    riskCount,
    overlapRiskCount,
    feetSortYRiskCount,
    groupBoundaryRiskCount,
  };
}

function analyzeReorderProbe(
  descriptors: readonly AuditDescriptor[],
  windowSize: 4 | 8 | 16,
): WorldReorderProbe {
  const reordered = buildReorderedDescriptors(descriptors, windowSize);
  const sequence = analyzeSequence(reordered);
  const risk = analyzeReorderRisk(descriptors, reordered, windowSize);
  return {
    windowSize,
    totalWorldBatches: sequence.totalWorldBatches,
    averageRunLength: sequence.averageRunLength,
    totalBatchBreaks: sequence.totalBatchBreaks,
    textureBreaks: sequence.breakReasonCounts["texture changed"],
    renderFamilyBreaks: sequence.breakReasonCounts["render family changed"],
    riskCount: risk.riskCount,
    overlapRiskCount: risk.overlapRiskCount,
    feetSortYRiskCount: risk.feetSortYRiskCount,
    groupBoundaryRiskCount: risk.groupBoundaryRiskCount,
  };
}

export function analyzeWorldBatchStream(
  commands: readonly RenderCommand[],
  selectedBackend: "canvas2d" | "webgl",
): WorldBatchAudit {
  const worldCommands = commands.filter((command) => command.pass === "WORLD");
  const textureIds = new WeakMap<object, number>();
  const nextTextureId = { value: 1 };
  const descriptors = worldCommands.map((command, index) => (
    buildAuditDescriptor(command, index, selectedBackend, textureIds, nextTextureId)
  ));

  let quadCommands = 0;
  let triangleCommands = 0;
  let batchableCommands = 0;
  let texturedCommands = 0;
  const uniqueTextureTokens = new Set<string>();
  for (const descriptor of descriptors) {
    if (descriptor.primitiveKind === "quad") quadCommands += 1;
    if (descriptor.batchable) batchableCommands += 1;
    if (descriptor.textureToken) {
      texturedCommands += 1;
      uniqueTextureTokens.add(descriptor.textureToken);
    }
  }

  const sequence = analyzeSequence(descriptors);
  const reorderProbes = selectedBackend === "webgl"
    ? REORDER_PROBE_WINDOWS.map((windowSize) => analyzeReorderProbe(descriptors, windowSize))
    : [];

  return {
    inspectedBackend: selectedBackend,
    compatibilityFields: [
      "semanticFamily/finalForm",
      "texture identity",
      "shader/material lane",
      "blend mode",
      "render backend path",
    ],
    totalWorldCommands: descriptors.length,
    quadCommands,
    triangleCommands,
    batchableCommands,
    texturedCommands,
    uniqueTextures: uniqueTextureTokens.size,
    totalWorldBatches: sequence.totalWorldBatches,
    averageRunLength: sequence.averageRunLength,
    maxRunLength: sequence.maxRunLength,
    compatibleContinuations: sequence.compatibleContinuations,
    totalBatchBreaks: sequence.totalBatchBreaks,
    breakReasonCounts: sequence.breakReasonCounts,
    familySummaries: sequence.familySummaries,
    sampleBoundaries: sequence.sampleBoundaries,
    topTextureBreakCauses: sequence.topTextureBreakCauses,
    runLengths: sequence.runLengths,
    reorderProbes,
  };
}
