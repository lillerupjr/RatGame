export const enum LoadingStage {
  COMPILE_MAP = 0,
  PRECOMPUTE_STATIC_MAP = 1,
  PREWARM_DEPENDENCIES = 2,
  PREPARE_STRUCTURE_TRIANGLES = 3,
  PRIME_AUDIO = 4,
  SPAWN_ENTITIES = 5,
  FINALIZE = 6,
  DONE = 7,
}

export type LoadProfilerPhaseStatus = "pending" | "running" | "completed" | "fail-open";
export type LoadProfilerStatus = "idle" | "running" | "completed";

export type LoadProfilerPhaseMetadata = {
  mapId?: string | null;
  failOpenReason?: "attempt-limit" | "elapsed-limit";
  attemptLimit?: number | null;
  elapsedLimitMs?: number | null;
};

export type LoadProfilerPhase = {
  name: string;
  stage: string;
  order: number;
  status: LoadProfilerPhaseStatus;
  durationMs: number | null;
  attemptCount: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  metadata?: LoadProfilerPhaseMetadata;
  children?: LoadProfilerPhase[];
};

export type LoadProfilerSummary = {
  status: LoadProfilerStatus;
  mapId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  totalLoadTimeMs: number | null;
  firstVisibleFrameTimeMs: number | null;
  fullyReadyTimeMs: number | null;
  topPhases: LoadProfilerPhase[];
};

export type LoadProfilerAccess = {
  getSummary(): LoadProfilerSummary;
  getPhases(): LoadProfilerPhase[];
};

export const LOAD_PROFILER_SUBPHASE = {
  MAP_CLONE_OR_CHUNK_DUPLICATION: "map clone / chunk duplication",
  SOURCE_MAP_READ_OR_PARSE: "source map read / parse",
  TILE_OR_SURFACE_EXPANSION: "tile / surface expansion",
  STRUCTURE_PLACEMENT: "structure placement",
  MONOLITHIC_SEMANTIC_PREPASS: "monolithic semantic prepass",
  ANCHOR_COMPUTATION: "anchor computation",
  FOOTPRINT_OR_N_M_COMPUTATION: "footprint / N/M computation",
  STRUCTURE_SLICE_GENERATION: "structure slice generation",
  TRIANGLE_GENERATION: "triangle generation",
  COLLISION_NAV_OR_BLOCKER_GENERATION: "collision / nav / blocker generation",
  SHADOW_OR_LIGHT_PRECOMPUTE: "shadow / light-related compile-time precompute",
  POST_COMPILE_INDEXING_OR_FINALIZATION: "post-compile indexing / finalization",
  DEPENDENCY_COLLECTION: "dependency collection",
  ENQUEUE_RUNTIME_PREWARM: "enqueue runtime prewarm",
  RUNTIME_PREWARM_WAIT: "runtime prewarm wait",
  PRIMARY_SPRITE_READINESS: "primary sprite readiness",
  SETTLE_SPRITE_READINESS: "settle sprite readiness",
  WALKABLE_MASK_PRECOMPUTE: "walkable mask precompute",
  ROAD_CONTEXT_PRECOMPUTE: "road context precompute",
} as const;

declare global {
  interface Window {
    __loadProfiler?: LoadProfilerAccess;
  }
}

export interface LoadingController {
  stage: LoadingStage;
  progress: number;

  beginMapLoad(mapId: string): void;
  tick(): void;
  markFirstVisibleFrame(): void;

  isDone(): boolean;
  getSummary(): LoadProfilerSummary;
  getPhases(): LoadProfilerPhase[];
}

type LoadingHooks = {
  compileMap: (mapId: string) => void | Promise<void>;
  precomputeStaticMap: () => void | Promise<void>;
  prewarmDependencies: () => boolean | Promise<boolean>;
  prepareStructureTriangles: () => boolean | Promise<boolean>;
  primeAudio: () => void | Promise<void>;
  spawnEntities: () => void | Promise<void>;
  finalize: () => void | Promise<void>;
};

type MutableLoadProfilerPhase = {
  stage: LoadingStage;
  name: string;
  order: number;
  status: LoadProfilerPhaseStatus;
  attemptCount: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  metadata?: LoadProfilerPhaseMetadata;
  childrenByName?: Map<string, MutableLoadProfilerChildPhase>;
};

type MutableLoadProfilerChildPhase = {
  name: string;
  stage: string;
  order: number;
  status: "completed";
  attemptCount: number;
  durationMs: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  metadata?: LoadProfilerPhaseMetadata;
};

type LoadProfilerSession = {
  status: LoadProfilerStatus;
  mapId: string | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  firstVisibleFrameAtMs: number | null;
  fullyReadyAtMs: number | null;
  summaryLogged: boolean;
  phases: Map<LoadingStage, MutableLoadProfilerPhase>;
};

const LOAD_PROFILER_TOP_PHASE_LIMIT = 10;
let activeLoadProfilerSession: LoadProfilerSession | null = null;
let activeLoadProfilerStage: LoadingStage | null = null;

function currentTimeMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function stageName(stage: LoadingStage): string {
  switch (stage) {
    case LoadingStage.COMPILE_MAP:
      return "COMPILE_MAP";
    case LoadingStage.PRECOMPUTE_STATIC_MAP:
      return "PRECOMPUTE_STATIC_MAP";
    case LoadingStage.PREWARM_DEPENDENCIES:
      return "PREWARM_DEPENDENCIES";
    case LoadingStage.PREPARE_STRUCTURE_TRIANGLES:
      return "PREPARE_STRUCTURE_TRIANGLES";
    case LoadingStage.PRIME_AUDIO:
      return "PRIME_AUDIO";
    case LoadingStage.SPAWN_ENTITIES:
      return "SPAWN_ENTITIES";
    case LoadingStage.FINALIZE:
      return "FINALIZE";
    case LoadingStage.DONE:
      return "DONE";
    default:
      return `UNKNOWN(${stage})`;
  }
}

function stageProgress(stage: LoadingStage): number {
  switch (stage) {
    case LoadingStage.COMPILE_MAP:
      return 0.15;
    case LoadingStage.PRECOMPUTE_STATIC_MAP:
      return 0.35;
    case LoadingStage.PREWARM_DEPENDENCIES:
      return 0.6;
    case LoadingStage.PREPARE_STRUCTURE_TRIANGLES:
      return 0.69;
    case LoadingStage.PRIME_AUDIO:
      return 0.78;
    case LoadingStage.SPAWN_ENTITIES:
      return 0.9;
    case LoadingStage.FINALIZE:
      return 0.98;
    case LoadingStage.DONE:
      return 1;
    default:
      return 0;
  }
}

function normalizeMapId(mapId: string): string | null {
  const trimmed = mapId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDurationMs(durationMs: number | null): string {
  return durationMs == null ? "n/a" : `${Math.round(durationMs)} ms`;
}

function createIdleSummary(): LoadProfilerSummary {
  return {
    status: "idle",
    mapId: null,
    startedAtMs: null,
    completedAtMs: null,
    totalLoadTimeMs: null,
    firstVisibleFrameTimeMs: null,
    fullyReadyTimeMs: null,
    topPhases: [],
  };
}

function createPendingPhase(stage: LoadingStage, mapId: string | null): MutableLoadProfilerPhase {
  return {
    stage,
    name: stageName(stage),
    order: stage,
    status: "pending",
    attemptCount: 0,
    startedAtMs: null,
    endedAtMs: null,
    metadata: {
      mapId,
    },
  };
}

function materializeChildPhases(
  childrenByName: Map<string, MutableLoadProfilerChildPhase> | undefined,
): LoadProfilerPhase[] | undefined {
  if (!childrenByName || childrenByName.size <= 0) return undefined;
  return [...childrenByName.values()]
    .map((child) => ({
      name: child.name,
      stage: child.stage,
      order: child.order,
      status: child.status,
      durationMs: child.durationMs,
      attemptCount: child.attemptCount,
      startedAtMs: child.startedAtMs,
      endedAtMs: child.endedAtMs,
      metadata: child.metadata ? { ...child.metadata } : undefined,
    }))
    .sort((a, b) => {
      const durationDelta = (b.durationMs ?? -1) - (a.durationMs ?? -1);
      if (durationDelta !== 0) return durationDelta;
      return a.order - b.order;
    });
}

function createLoadProfilerSession(
  stageOrder: readonly LoadingStage[],
  mapId: string | null,
  startedAtMs: number,
): LoadProfilerSession {
  const phases = new Map<LoadingStage, MutableLoadProfilerPhase>();
  for (let i = 0; i < stageOrder.length; i++) {
    const stage = stageOrder[i];
    phases.set(stage, createPendingPhase(stage, mapId));
  }
  return {
    status: "running",
    mapId,
    startedAtMs,
    completedAtMs: null,
    firstVisibleFrameAtMs: null,
    fullyReadyAtMs: null,
    summaryLogged: false,
    phases,
  };
}

function materializePhase(
  phase: MutableLoadProfilerPhase,
  nowMs: number,
): LoadProfilerPhase {
  const durationMs =
    phase.startedAtMs == null
      ? null
      : (phase.endedAtMs ?? nowMs) - phase.startedAtMs;
  return {
    name: phase.name,
    stage: stageName(phase.stage),
    order: phase.order,
    status: phase.status,
    durationMs,
    attemptCount: phase.attemptCount,
    startedAtMs: phase.startedAtMs,
    endedAtMs: phase.endedAtMs,
    metadata: phase.metadata ? { ...phase.metadata } : undefined,
    children: materializeChildPhases(phase.childrenByName),
  };
}

function buildPhaseSnapshots(
  session: LoadProfilerSession | null,
  stageOrder: readonly LoadingStage[],
  nowMs: number,
): LoadProfilerPhase[] {
  if (!session) return [];
  const phases: LoadProfilerPhase[] = [];
  for (let i = 0; i < stageOrder.length; i++) {
    const phase = session.phases.get(stageOrder[i]);
    if (!phase) continue;
    phases.push(materializePhase(phase, nowMs));
  }
  return phases;
}

function sortTopPhases(phases: readonly LoadProfilerPhase[]): LoadProfilerPhase[] {
  return [...phases]
    .filter((phase) => phase.durationMs != null)
    .sort((a, b) => {
      const durationDelta = (b.durationMs ?? -1) - (a.durationMs ?? -1);
      if (durationDelta !== 0) return durationDelta;
      return a.order - b.order;
    })
    .slice(0, LOAD_PROFILER_TOP_PHASE_LIMIT);
}

function buildSummary(
  session: LoadProfilerSession | null,
  stageOrder: readonly LoadingStage[],
  nowMs: number,
): LoadProfilerSummary {
  if (!session) return createIdleSummary();
  const phases = buildPhaseSnapshots(session, stageOrder, nowMs);
  return {
    status: session.status,
    mapId: session.mapId,
    startedAtMs: session.startedAtMs,
    completedAtMs: session.completedAtMs,
    totalLoadTimeMs:
      session.startedAtMs != null && session.completedAtMs != null
        ? session.completedAtMs - session.startedAtMs
        : null,
    firstVisibleFrameTimeMs:
      session.startedAtMs != null && session.firstVisibleFrameAtMs != null
        ? session.firstVisibleFrameAtMs - session.startedAtMs
        : null,
    fullyReadyTimeMs:
      session.startedAtMs != null && session.fullyReadyAtMs != null
        ? session.fullyReadyAtMs - session.startedAtMs
        : null,
    topPhases: sortTopPhases(phases),
  };
}

export function formatLoadProfilerSummaryBlock(
  summary: LoadProfilerSummary,
  phases: readonly LoadProfilerPhase[] = [],
): string {
  const topPhases = summary.topPhases.slice(0, LOAD_PROFILER_TOP_PHASE_LIMIT);
  const nameWidth = Math.max(
    "Top phases".length,
    ...topPhases.map((phase) => phase.name.length),
  );
  const lines = [
    `[LoadProfiler] Total: ${formatDurationMs(summary.totalLoadTimeMs)}`,
    `[LoadProfiler] FirstFrame: ${formatDurationMs(summary.firstVisibleFrameTimeMs)}`,
    `[LoadProfiler] FullyReady: ${formatDurationMs(summary.fullyReadyTimeMs)}`,
    "[LoadProfiler] Top phases:",
  ];

  if (topPhases.length <= 0) {
    lines.push("[LoadProfiler]   (no phases)");
    return lines.join("\n");
  }

  for (let i = 0; i < topPhases.length; i++) {
    const phase = topPhases[i];
    lines.push(
      `[LoadProfiler]   ${phase.name.padEnd(nameWidth, " ")} ${formatDurationMs(phase.durationMs)}`,
    );
  }

  const compileMapPhase = phases.find((phase) => phase.name === "COMPILE_MAP");
  const compileMapChildren = compileMapPhase?.children ?? [];
  if (compileMapPhase?.durationMs != null && compileMapChildren.length > 0) {
    const childNameWidth = Math.max(
      "COMPILE_MAP".length,
      ...compileMapChildren.map((phase) => phase.name.length),
    );
    lines.push(`[LoadProfiler] COMPILE_MAP total: ${formatDurationMs(compileMapPhase.durationMs)}`);
    for (let i = 0; i < compileMapChildren.length; i++) {
      const child = compileMapChildren[i];
      lines.push(
        `[LoadProfiler]   ${child.name.padEnd(childNameWidth, " ")} ${formatDurationMs(child.durationMs)}`,
      );
    }
  }

  return lines.join("\n");
}

export function attachLoadProfilerGlobal(access: LoadProfilerAccess): void {
  if (typeof window === "undefined") return;
  window.__loadProfiler = access;
}

export function beginLoadProfilerSubphase(
  name: string,
  metadata?: LoadProfilerPhaseMetadata,
): () => void {
  const session = activeLoadProfilerSession;
  const stage = activeLoadProfilerStage;
  if (!session || stage == null) return () => {};

  const parentPhase = session.phases.get(stage);
  if (!parentPhase) return () => {};

  const startedAtMs = currentTimeMs();
  let ended = false;

  return () => {
    if (ended) return;
    ended = true;

    const endedAtMs = currentTimeMs();
    const durationMs = Math.max(0, endedAtMs - startedAtMs);
    const childrenByName = parentPhase.childrenByName ?? new Map<string, MutableLoadProfilerChildPhase>();
    parentPhase.childrenByName = childrenByName;
    const existing = childrenByName.get(name);
    if (existing) {
      existing.durationMs += durationMs;
      existing.attemptCount += 1;
      if (existing.startedAtMs == null || startedAtMs < existing.startedAtMs) {
        existing.startedAtMs = startedAtMs;
      }
      if (existing.endedAtMs == null || endedAtMs > existing.endedAtMs) {
        existing.endedAtMs = endedAtMs;
      }
      existing.metadata = {
        ...(existing.metadata ?? {}),
        ...(metadata ?? {}),
      };
      return;
    }

    childrenByName.set(name, {
      name,
      stage: name,
      order: childrenByName.size,
      status: "completed",
      attemptCount: 1,
      durationMs,
      startedAtMs,
      endedAtMs,
      metadata: metadata ? { ...metadata } : undefined,
    });
  };
}

export function runWithLoadProfilerSubphase<T>(
  name: string,
  run: () => T,
  metadata?: LoadProfilerPhaseMetadata,
): T {
  const end = beginLoadProfilerSubphase(name, metadata);
  try {
    return run();
  } finally {
    end();
  }
}

export async function runWithLoadProfilerSubphaseAsync<T>(
  name: string,
  run: () => Promise<T>,
  metadata?: LoadProfilerPhaseMetadata,
): Promise<T> {
  const end = beginLoadProfilerSubphase(name, metadata);
  try {
    return await run();
  } finally {
    end();
  }
}

export function createLoadingController(hooks: LoadingHooks): LoadingController {
  // Development policy: never let PREWARM_DEPENDENCIES loop forever.
  // If readiness cannot converge within these bounds, fail open and continue.
  const STAGE_FAIL_OPEN_ATTEMPT_LIMIT: Partial<Record<LoadingStage, number>> = {
    [LoadingStage.PREWARM_DEPENDENCIES]: 4,
  };
  const STAGE_FAIL_OPEN_ELAPSED_MS: Partial<Record<LoadingStage, number>> = {
    [LoadingStage.PREWARM_DEPENDENCIES]: 9000,
  };

  const stageOrder: LoadingStage[] = [
    LoadingStage.COMPILE_MAP,
    LoadingStage.PRECOMPUTE_STATIC_MAP,
    LoadingStage.PREWARM_DEPENDENCIES,
    LoadingStage.PREPARE_STRUCTURE_TRIANGLES,
    LoadingStage.PRIME_AUDIO,
    LoadingStage.SPAWN_ENTITIES,
    LoadingStage.FINALIZE,
  ];

  let currentMapId = "";
  let stageRunning = false;
  let prewarmInitialized = false;
  let audioPrimed = false;
  let stageIndex = 0;
  let stageDone = false;
  let session: LoadProfilerSession | null = null;
  const stageAttemptByStage = new Map<LoadingStage, number>();
  const stageEnteredAtByStage = new Map<LoadingStage, number>();

  const getSummary = (): LoadProfilerSummary => buildSummary(session, stageOrder, currentTimeMs());
  const getPhases = (): LoadProfilerPhase[] => buildPhaseSnapshots(session, stageOrder, currentTimeMs());

  const maybeLogSummary = (): void => {
    if (!session || session.summaryLogged) return;
    if (session.completedAtMs == null || session.firstVisibleFrameAtMs == null) return;
    console.log(formatLoadProfilerSummaryBlock(getSummary(), getPhases()));
    session.summaryLogged = true;
  };

  const markStageRunning = (stage: LoadingStage, nowMs: number): void => {
    if (!session) return;
    const phase = session.phases.get(stage);
    if (!phase) return;
    if (phase.startedAtMs == null) {
      phase.startedAtMs = nowMs;
    }
    phase.status = "running";
  };

  const completeStage = (
    stage: LoadingStage,
    status: "completed" | "fail-open",
    metadata: LoadProfilerPhaseMetadata | undefined,
    endedAtMs: number,
  ): void => {
    if (!session) return;
    const phase = session.phases.get(stage);
    if (!phase) return;
    phase.status = status;
    phase.endedAtMs = endedAtMs;
    phase.attemptCount = stageAttemptByStage.get(stage) ?? phase.attemptCount;
    phase.metadata = {
      ...(phase.metadata ?? {}),
      ...(metadata ?? {}),
    };
  };

  const markSessionCompleted = (completedAtMs: number): void => {
    if (!session || session.status === "completed") return;
    session.status = "completed";
    session.completedAtMs = completedAtMs;
  };

  const runCurrentStage = async (stage: LoadingStage): Promise<void> => {
    switch (stage) {
      case LoadingStage.COMPILE_MAP:
        await hooks.compileMap(currentMapId);
        stageDone = true;
        break;
      case LoadingStage.PRECOMPUTE_STATIC_MAP:
        await hooks.precomputeStaticMap();
        stageDone = true;
        break;
      case LoadingStage.PREWARM_DEPENDENCIES:
        if (!prewarmInitialized) prewarmInitialized = true;
        stageDone = await hooks.prewarmDependencies();
        break;
      case LoadingStage.PREPARE_STRUCTURE_TRIANGLES:
        stageDone = await hooks.prepareStructureTriangles();
        break;
      case LoadingStage.PRIME_AUDIO:
        if (!audioPrimed) {
          await hooks.primeAudio();
          audioPrimed = true;
        }
        stageDone = true;
        break;
      case LoadingStage.SPAWN_ENTITIES:
        await hooks.spawnEntities();
        stageDone = true;
        break;
      case LoadingStage.FINALIZE:
        await hooks.finalize();
        stageDone = true;
        break;
      default:
        stageDone = true;
        break;
    }
  };

  const controller: LoadingController = {
    stage: LoadingStage.COMPILE_MAP,
    progress: 0,
    beginMapLoad(mapId: string) {
      const nowMs = currentTimeMs();
      currentMapId = mapId;
      stageRunning = false;
      prewarmInitialized = false;
      audioPrimed = false;
      stageIndex = 0;
      stageDone = false;
      stageAttemptByStage.clear();
      stageEnteredAtByStage.clear();
      session = createLoadProfilerSession(stageOrder, normalizeMapId(mapId), nowMs);
      activeLoadProfilerSession = session;
      activeLoadProfilerStage = null;
      controller.stage = stageOrder[0];
      controller.progress = stageProgress(LoadingStage.COMPILE_MAP);
    },
    tick() {
      if (stageIndex >= stageOrder.length) {
        controller.stage = LoadingStage.DONE;
        controller.progress = 1;
        activeLoadProfilerStage = null;
        if (session) {
          markSessionCompleted(session.completedAtMs ?? currentTimeMs());
        }
        return;
      }
      if (stageRunning) return;

      const stage = stageOrder[stageIndex];
      const startNowMs = currentTimeMs();
      controller.stage = stage;
      if (!stageEnteredAtByStage.has(stage)) {
        stageEnteredAtByStage.set(stage, startNowMs);
      }
      markStageRunning(stage, startNowMs);
      activeLoadProfilerStage = stage;

      stageRunning = true;
      void runCurrentStage(stage)
        .finally(() => {
          const attempt = (stageAttemptByStage.get(stage) ?? 0) + 1;
          stageAttemptByStage.set(stage, attempt);
          const phase = session?.phases.get(stage);
          if (phase) phase.attemptCount = attempt;
          stageRunning = false;
          activeLoadProfilerStage = null;
          const nowMs = currentTimeMs();

          if (!stageDone) {
            const enteredAt = stageEnteredAtByStage.get(stage) ?? nowMs;
            const elapsedMs = nowMs - enteredAt;
            const attemptLimit = STAGE_FAIL_OPEN_ATTEMPT_LIMIT[stage];
            const elapsedLimit = STAGE_FAIL_OPEN_ELAPSED_MS[stage];
            const attemptLimitExceeded = attemptLimit !== undefined && attempt >= attemptLimit;
            const elapsedLimitExceeded = elapsedLimit !== undefined && elapsedMs >= elapsedLimit;
            if (attemptLimitExceeded || elapsedLimitExceeded) {
              const failOpenReason = attemptLimitExceeded ? "attempt-limit" : "elapsed-limit";
              stageDone = true;
              completeStage(stage, "fail-open", {
                mapId: session?.mapId ?? null,
                failOpenReason,
                attemptLimit: attemptLimit ?? null,
                elapsedLimitMs: elapsedLimit ?? null,
              }, nowMs);
              console.warn("[loading] stage fail-open", {
                stage: stageName(stage),
                attempt,
                elapsedMs: Math.round(elapsedMs),
                attemptLimit: attemptLimit ?? null,
                elapsedLimitMs: elapsedLimit ?? null,
                reason: failOpenReason,
              });
            }
          } else {
            completeStage(stage, "completed", {
              mapId: session?.mapId ?? null,
            }, nowMs);
          }

          if (stageDone) {
            stageEnteredAtByStage.delete(stage);
            stageIndex++;
            stageDone = false;
          }
          if (stageIndex >= stageOrder.length) {
            controller.stage = LoadingStage.DONE;
            controller.progress = 1;
            markSessionCompleted(nowMs);
          } else {
            controller.stage = stageOrder[stageIndex];
            controller.progress = Math.max(controller.progress, stageProgress(controller.stage));
          }
        });
    },
    markFirstVisibleFrame() {
      if (!session || session.status !== "completed" || session.firstVisibleFrameAtMs != null) return;
      session.firstVisibleFrameAtMs = currentTimeMs();
      maybeLogSummary();
    },
    isDone() {
      return stageIndex >= stageOrder.length;
    },
    getSummary,
    getPhases,
  };

  return controller;
}
