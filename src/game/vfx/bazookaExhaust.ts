export type BazookaExhaustStage = "ignite" | "loop" | "shutdown";

export interface BazookaExhaustSpec {
  basePath: string;
  fps: number;
  anchorExhaust: [number, number];
}

export interface BazookaExhaustRuntime {
  stage: BazookaExhaustStage;
  frame: number;
  t: number;
  done: boolean;
}

export function makeBazookaExhaustRuntime(): BazookaExhaustRuntime {
  return { stage: "ignite", frame: 0, t: 0, done: false };
}

export interface ExhaustFrames<TFrame> {
  ignite: TFrame[];
  loop: TFrame[];
  shutdown: TFrame[];
}

export function stepBazookaExhaust<TFrame>(
  rt: BazookaExhaustRuntime,
  dtSec: number,
  fps: number,
  frames: ExhaustFrames<TFrame>
): { frame: TFrame | null; stage: BazookaExhaustStage; done: boolean } {
  if (rt.done) return { frame: null, stage: rt.stage, done: true };

  rt.t += dtSec;
  const frameAdvance = Math.floor(rt.t * fps);
  if (frameAdvance > 0) {
    rt.t -= frameAdvance / fps;
    rt.frame += frameAdvance;
  }

  const arr = rt.stage === "ignite"
    ? frames.ignite
    : rt.stage === "loop"
      ? frames.loop
      : frames.shutdown;

  if (arr.length === 0) {
    rt.done = true;
    return { frame: null, stage: rt.stage, done: true };
  }

  if (rt.stage === "loop") {
    rt.frame = rt.frame % arr.length;
    return { frame: arr[rt.frame], stage: rt.stage, done: false };
  }

  if (rt.frame >= arr.length) {
    if (rt.stage === "ignite") {
      rt.stage = "loop";
      rt.frame = 0;
      return stepBazookaExhaust(rt, 0, fps, frames);
    }
    rt.done = true;
    return { frame: null, stage: rt.stage, done: true };
  }

  return { frame: arr[rt.frame], stage: rt.stage, done: false };
}

export function requestShutdown(rt: BazookaExhaustRuntime): void {
  if (rt.stage !== "shutdown") {
    rt.stage = "shutdown";
    rt.frame = 0;
    rt.t = 0;
    rt.done = false;
  }
}
