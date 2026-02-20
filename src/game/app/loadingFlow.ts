export const enum LoadingStage {
  COMPILE_MAP = 0,
  PRECOMPUTE_STATIC_MAP = 1,
  PREWARM_DEPENDENCIES = 2,
  PRIME_AUDIO = 3,
  SPAWN_ENTITIES = 4,
  FINALIZE = 5,
  DONE = 6,
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
  primeAudio: () => void | Promise<void>;
  spawnEntities: () => void | Promise<void>;
  finalize: () => void | Promise<void>;
};

function stageProgress(stage: LoadingStage): number {
  switch (stage) {
    case LoadingStage.COMPILE_MAP:
      return 0.15;
    case LoadingStage.PRECOMPUTE_STATIC_MAP:
      return 0.35;
    case LoadingStage.PREWARM_DEPENDENCIES:
      return 0.6;
    case LoadingStage.PRIME_AUDIO:
      return 0.75;
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

export function createLoadingController(hooks: LoadingHooks): LoadingController {
  let currentMapId = "";
  let stageRunning = false;
  let prewarmInitialized = false;
  let audioPrimed = false;
  let stageIndex = 0;
  let stageDone = false;

  const stageOrder: LoadingStage[] = [
    LoadingStage.COMPILE_MAP,
    LoadingStage.PRECOMPUTE_STATIC_MAP,
    LoadingStage.PREWARM_DEPENDENCIES,
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
      controller.stage = stageOrder[0];
      controller.progress = stageProgress(LoadingStage.COMPILE_MAP);
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

      stageRunning = true;
      void runCurrentStage(stage)
        .finally(() => {
          stageRunning = false;
          if (stageDone) {
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
