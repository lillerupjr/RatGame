export const enum LoadingStage {
  COMPILE_MAP = 0,
  PRECOMPUTE_STATIC_MAP = 1,
  PREWARM_DEPENDENCIES = 2,
  PREPARE_STRUCTURE_TRIANGLES = 3,
  PREPARE_STATIC_RELIGHT = 4,
  PRIME_AUDIO = 5,
  SPAWN_ENTITIES = 6,
  FINALIZE = 7,
  DONE = 8,
}

export interface LoadingController {
  stage: LoadingStage;
  progress: number;

  beginMapLoad(mapId: string): void;
  tick(): void;

  isDone(): boolean;
}

type LoadingHooks = {
  compileMap: (mapId: string) => void | Promise<void>;
  precomputeStaticMap: () => void | Promise<void>;
  prewarmDependencies: () => boolean | Promise<boolean>;
  prepareStructureTriangles: () => boolean | Promise<boolean>;
  prepareStaticRelight: () => boolean | Promise<boolean>;
  primeAudio: () => void | Promise<void>;
  spawnEntities: () => void | Promise<void>;
  finalize: () => void | Promise<void>;
};

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
    case LoadingStage.PREPARE_STATIC_RELIGHT:
      return "PREPARE_STATIC_RELIGHT";
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
    case LoadingStage.PREPARE_STATIC_RELIGHT:
      return 0.75;
    case LoadingStage.PRIME_AUDIO:
      return 0.84;
    case LoadingStage.SPAWN_ENTITIES:
      return 0.93;
    case LoadingStage.FINALIZE:
      return 0.98;
    case LoadingStage.DONE:
      return 1;
    default:
      return 0;
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

  let currentMapId = "";
  let stageRunning = false;
  let prewarmInitialized = false;
  let audioPrimed = false;
  let stageIndex = 0;
  let stageDone = false;
  const stageAttemptByStage = new Map<LoadingStage, number>();
  const stageEnteredAtByStage = new Map<LoadingStage, number>();
  const stagePendingLogAtByStage = new Map<LoadingStage, number>();
  const stageEnterLogged = new Set<LoadingStage>();

  const stageOrder: LoadingStage[] = [
    LoadingStage.COMPILE_MAP,
    LoadingStage.PRECOMPUTE_STATIC_MAP,
    LoadingStage.PREWARM_DEPENDENCIES,
    LoadingStage.PREPARE_STRUCTURE_TRIANGLES,
    LoadingStage.PREPARE_STATIC_RELIGHT,
    LoadingStage.PRIME_AUDIO,
    LoadingStage.SPAWN_ENTITIES,
    LoadingStage.FINALIZE,
  ];

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
      case LoadingStage.PREPARE_STATIC_RELIGHT:
        stageDone = await hooks.prepareStaticRelight();
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
      currentMapId = mapId;
      stageRunning = false;
      prewarmInitialized = false;
      audioPrimed = false;
      stageIndex = 0;
      stageDone = false;
      stageAttemptByStage.clear();
      stageEnteredAtByStage.clear();
      stagePendingLogAtByStage.clear();
      stageEnterLogged.clear();
      controller.stage = stageOrder[0];
      controller.progress = stageProgress(LoadingStage.COMPILE_MAP);
      console.debug(`[loading] begin map load: mapId="${mapId}"`);
    },
    tick() {
      if (stageIndex >= stageOrder.length) {
        controller.stage = LoadingStage.DONE;
        controller.progress = 1;
        return;
      }
      if (stageRunning) return;

      const stage = stageOrder[stageIndex];
      controller.stage = stage;
      if (!stageEnteredAtByStage.has(stage)) {
        stageEnteredAtByStage.set(stage, performance.now());
      }
      if (!stageEnterLogged.has(stage)) {
        stageEnterLogged.add(stage);
        console.debug(`[loading] stage enter: ${stageName(stage)}`);
      }

      stageRunning = true;
      void runCurrentStage(stage)
        .finally(() => {
          const attempt = (stageAttemptByStage.get(stage) ?? 0) + 1;
          stageAttemptByStage.set(stage, attempt);
          stageRunning = false;
          if (!stageDone) {
            const now = performance.now();
            const enteredAt = stageEnteredAtByStage.get(stage) ?? now;
            const elapsedMs = now - enteredAt;
            const attemptLimit = STAGE_FAIL_OPEN_ATTEMPT_LIMIT[stage];
            const elapsedLimit = STAGE_FAIL_OPEN_ELAPSED_MS[stage];
            const attemptLimitExceeded = attemptLimit !== undefined && attempt >= attemptLimit;
            const elapsedLimitExceeded = elapsedLimit !== undefined && elapsedMs >= elapsedLimit;
            if (attemptLimitExceeded || elapsedLimitExceeded) {
              stageDone = true;
              console.warn("[loading] stage fail-open", {
                stage: stageName(stage),
                attempt,
                elapsedMs: Math.round(elapsedMs),
                attemptLimit: attemptLimit ?? null,
                elapsedLimitMs: elapsedLimit ?? null,
                reason: attemptLimitExceeded ? "attempt-limit" : "elapsed-limit",
              });
            } else {
              const lastLogAt = stagePendingLogAtByStage.get(stage) ?? 0;
              if (now - lastLogAt >= 1000) {
                stagePendingLogAtByStage.set(stage, now);
                console.debug(`[loading] stage pending: ${stageName(stage)} (attempt ${attempt})`);
              }
            }
          } else {
            console.debug(`[loading] stage complete: ${stageName(stage)} (attempt ${attempt})`);
          }
          if (stageDone) {
            stageEnteredAtByStage.delete(stage);
            stageIndex++;
            stageDone = false;
          }
          if (stageIndex >= stageOrder.length) {
            controller.stage = LoadingStage.DONE;
            controller.progress = 1;
          } else {
            controller.stage = stageOrder[stageIndex];
            controller.progress = Math.max(controller.progress, stageProgress(controller.stage));
          }
        });
    },
    isDone() {
      return stageIndex >= stageOrder.length;
    },
  };

  return controller;
}
