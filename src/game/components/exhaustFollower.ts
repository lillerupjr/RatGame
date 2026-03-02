import type { BazookaExhaustRuntime } from "../vfx/bazookaExhaust";
import { makeBazookaExhaustRuntime } from "../vfx/bazookaExhaust";

export interface ExhaustFollower {
  kind: "bazooka_exhaust";
  targetEntity: number;
  rt: BazookaExhaustRuntime;
  variant: 1;
}

export function makeBazookaExhaustFollower(targetEntity: number): ExhaustFollower {
  return {
    kind: "bazooka_exhaust",
    targetEntity,
    rt: makeBazookaExhaustRuntime(),
    variant: 1,
  };
}
