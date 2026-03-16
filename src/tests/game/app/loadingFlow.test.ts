import { describe, expect, it } from "vitest";
import { createLoadingController } from "../../../game/app/loadingFlow";

async function tickUntilDone(
  controller: ReturnType<typeof createLoadingController>,
  maxTicks: number = 64,
): Promise<void> {
  for (let i = 0; i < maxTicks && !controller.isDone(); i++) {
    controller.tick();
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe("loadingFlow", () => {
  it("runs structure-triangle and static-relight stages after prewarm and before spawn", async () => {
    const calls: string[] = [];
    const controller = createLoadingController({
      compileMap: async () => { calls.push("compile"); },
      precomputeStaticMap: async () => { calls.push("precompute"); },
      prewarmDependencies: async () => {
        calls.push("prewarm");
        return true;
      },
      prepareStructureTriangles: async () => {
        calls.push("triangles");
        return true;
      },
      prepareStaticRelight: async () => {
        calls.push("relight");
        return true;
      },
      primeAudio: async () => { calls.push("audio"); },
      spawnEntities: async () => { calls.push("spawn"); },
      finalize: async () => { calls.push("finalize"); },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller);

    expect(controller.isDone()).toBe(true);
    expect(calls).toEqual([
      "compile",
      "precompute",
      "prewarm",
      "triangles",
      "relight",
      "audio",
      "spawn",
      "finalize",
    ]);
  });

  it("keeps loading blocked until relight stage reports completion", async () => {
    const calls: string[] = [];
    let relightAttempts = 0;
    const controller = createLoadingController({
      compileMap: async () => { calls.push("compile"); },
      precomputeStaticMap: async () => { calls.push("precompute"); },
      prewarmDependencies: async () => {
        calls.push("prewarm");
        return true;
      },
      prepareStructureTriangles: async () => {
        calls.push("triangles");
        return true;
      },
      prepareStaticRelight: async () => {
        relightAttempts++;
        calls.push(`relight:${relightAttempts}`);
        return relightAttempts >= 3;
      },
      primeAudio: async () => { calls.push("audio"); },
      spawnEntities: async () => { calls.push("spawn"); },
      finalize: async () => { calls.push("finalize"); },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller);

    expect(controller.isDone()).toBe(true);
    expect(relightAttempts).toBe(3);
    expect(calls).toContain("spawn");
    expect(calls.indexOf("spawn")).toBeGreaterThan(calls.indexOf("relight:3"));
  });

  it("fails open prewarm stage after bounded attempts so loading cannot hang forever", async () => {
    const calls: string[] = [];
    let prewarmAttempts = 0;
    const controller = createLoadingController({
      compileMap: async () => { calls.push("compile"); },
      precomputeStaticMap: async () => { calls.push("precompute"); },
      prewarmDependencies: async () => {
        prewarmAttempts++;
        calls.push(`prewarm:${prewarmAttempts}`);
        return false;
      },
      prepareStructureTriangles: async () => {
        calls.push("triangles");
        return true;
      },
      prepareStaticRelight: async () => {
        calls.push("relight");
        return true;
      },
      primeAudio: async () => { calls.push("audio"); },
      spawnEntities: async () => { calls.push("spawn"); },
      finalize: async () => { calls.push("finalize"); },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller, 128);

    expect(controller.isDone()).toBe(true);
    expect(prewarmAttempts).toBe(4);
    expect(calls).toContain("spawn");
    expect(calls).toContain("finalize");
  });
});
