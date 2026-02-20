export const enum LoadingStage {
  NONE = 0,
  COMPILE_MAP = 1,
  PREWARM_SPRITES = 2,
  SPAWN_ENTITIES = 3,
  FINALIZE = 4,
  DONE = 5,
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
  prewarmSprites: () => void | Promise<void>;
  spawnEntities: () => void | Promise<void>;
  finalize: () => void | Promise<void>;
};

function stageProgress(stage: LoadingStage): number {
  switch (stage) {
    case LoadingStage.NONE:
      return 0;
    case LoadingStage.COMPILE_MAP:
      return 0.2;
    case LoadingStage.PREWARM_SPRITES:
      return 0.45;
    case LoadingStage.SPAWN_ENTITIES:
      return 0.75;
    case LoadingStage.FINALIZE:
      return 0.92;
    case LoadingStage.DONE:
      return 1;
    default:
      return 0;
  }
}

export function createLoadingController(hooks: LoadingHooks): LoadingController {
  let currentMapId = "";
  let activeJob: Promise<void> | null = null;
  let stageRunning = false;

  const controller: LoadingController = {
    stage: LoadingStage.NONE,
    progress: 0,
    beginMapLoad(mapId: string) {
      currentMapId = mapId;
      activeJob = null;
      stageRunning = false;
      controller.stage = LoadingStage.COMPILE_MAP;
      controller.progress = stageProgress(LoadingStage.COMPILE_MAP);
    },
    tick() {
      if (controller.stage === LoadingStage.NONE || controller.stage === LoadingStage.DONE) return;
      if (stageRunning) return;

      const runStage = async () => {
        switch (controller.stage) {
          case LoadingStage.COMPILE_MAP:
            await hooks.compileMap(currentMapId);
            controller.stage = LoadingStage.PREWARM_SPRITES;
            break;
          case LoadingStage.PREWARM_SPRITES:
            await hooks.prewarmSprites();
            controller.stage = LoadingStage.SPAWN_ENTITIES;
            break;
          case LoadingStage.SPAWN_ENTITIES:
            await hooks.spawnEntities();
            controller.stage = LoadingStage.FINALIZE;
            break;
          case LoadingStage.FINALIZE:
            await hooks.finalize();
            controller.stage = LoadingStage.DONE;
            break;
          default:
            controller.stage = LoadingStage.DONE;
            break;
        }
      };

      stageRunning = true;
      activeJob = runStage()
        .catch(() => {
          controller.stage = LoadingStage.DONE;
        })
        .finally(() => {
          stageRunning = false;
          controller.progress = Math.max(controller.progress, stageProgress(controller.stage));
          activeJob = null;
        });
    },
    isDone() {
      return controller.stage === LoadingStage.DONE && !activeJob && !stageRunning;
    },
  };

  return controller;
}
