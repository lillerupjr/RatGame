import { describe, expect, test } from "vitest";
import {
  makeBazookaExhaustRuntime,
  requestShutdown,
  stepBazookaExhaust,
  type ExhaustFrames,
} from "../../../game/vfx/bazookaExhaust";

describe("bazookaExhaust stage machine", () => {
  test("transitions ignite -> loop and loops frames", () => {
    const rt = makeBazookaExhaustRuntime();
    const frames: ExhaustFrames<string> = {
      ignite: ["i0", "i1"],
      loop: ["l0", "l1", "l2"],
      shutdown: ["s0"],
    };

    // Advance two ignite frames at 10fps.
    let out = stepBazookaExhaust(rt, 0.2, 10, frames);
    expect(out.stage).toBe("loop");
    expect(out.done).toBe(false);
    expect(out.frame).toBe("l0");

    // Loop continues and wraps.
    out = stepBazookaExhaust(rt, 0.3, 10, frames);
    expect(out.stage).toBe("loop");
    expect(out.done).toBe(false);
    expect(out.frame).toBe("l0");
  });

  test("requestShutdown plays shutdown once and ends", () => {
    const rt = makeBazookaExhaustRuntime();
    const frames: ExhaustFrames<string> = {
      ignite: ["i0"],
      loop: ["l0"],
      shutdown: ["s0", "s1"],
    };

    // Move into loop state first.
    stepBazookaExhaust(rt, 0.2, 10, frames);
    expect(rt.stage).toBe("loop");

    requestShutdown(rt);
    let out = stepBazookaExhaust(rt, 0.1, 10, frames);
    expect(out.stage).toBe("shutdown");
    expect(out.done).toBe(false);
    expect(out.frame).toBe("s1");

    out = stepBazookaExhaust(rt, 0.1, 10, frames);
    expect(out.stage).toBe("shutdown");
    expect(out.done).toBe(true);
    expect(out.frame).toBeNull();
  });
});
