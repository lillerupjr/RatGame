import type { ExhaustFollower } from "../components/exhaustFollower";
import { requestShutdown, stepBazookaExhaust, type ExhaustFrames } from "../vfx/bazookaExhaust";

export type FrameHandle = HTMLImageElement;

export interface ExhaustAssets {
  spec: {
    basePath: string;
    fps: number;
    anchorExhaust: [number, number];
  };
  frames: ExhaustFrames<FrameHandle>;
}

type ExhaustFollowerStore = Record<number, ExhaustFollower>;
type ExhaustFrameStore = Record<number, FrameHandle | null>;

export function updateExhaustFollowers(world: any, dtSec: number, assets: ExhaustAssets): void {
  const store = (world.exhaustFollower ?? {}) as ExhaustFollowerStore;
  world.exhaustFollower = store;
  const framesStore = (world.exhaustFollowerFrame ?? {}) as ExhaustFrameStore;
  world.exhaustFollowerFrame = framesStore;

  const fps = assets.spec.fps;
  for (const key of Object.keys(store)) {
    const eid = Number(key);
    const follower = store[eid];
    if (!follower || follower.kind !== "bazooka_exhaust") continue;

    const target = follower.targetEntity;
    const targetAlive = !!world.pAlive?.[target];
    if (!targetAlive) {
      requestShutdown(follower.rt);
    }

    const step = stepBazookaExhaust(follower.rt, dtSec, fps, assets.frames);
    framesStore[eid] = step.frame;

    if (step.done) {
      delete store[eid];
      delete framesStore[eid];
    }
  }
}
