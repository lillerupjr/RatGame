import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginLoadProfilerSubphase,
  createLoadingController,
  formatLoadProfilerSummaryBlock,
  LOAD_PROFILER_SUBPHASE,
  type LoadProfilerSummary,
} from "../../../game/app/loadingFlow";

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
  let nowMs = 0;

  beforeEach(() => {
    nowMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs structure-triangle stage after prewarm and before spawn", async () => {
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
      "audio",
      "spawn",
      "finalize",
    ]);
  });

  it("keeps loading blocked until structure stage reports completion", async () => {
    const calls: string[] = [];
    let triangleAttempts = 0;
    const controller = createLoadingController({
      compileMap: async () => { calls.push("compile"); },
      precomputeStaticMap: async () => { calls.push("precompute"); },
      prewarmDependencies: async () => {
        calls.push("prewarm");
        return true;
      },
      prepareStructureTriangles: async () => {
        triangleAttempts++;
        calls.push(`triangles:${triangleAttempts}`);
        return triangleAttempts >= 3;
      },
      primeAudio: async () => { calls.push("audio"); },
      spawnEntities: async () => { calls.push("spawn"); },
      finalize: async () => { calls.push("finalize"); },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller);

    expect(controller.isDone()).toBe(true);
    expect(triangleAttempts).toBe(3);
    expect(calls).toContain("spawn");
    expect(calls.indexOf("spawn")).toBeGreaterThan(calls.indexOf("triangles:3"));
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

  it("exposes safe summary and phase data before and during loading", async () => {
    const controller = createLoadingController({
      compileMap: async () => { nowMs += 10; },
      precomputeStaticMap: async () => { nowMs += 8; },
      prewarmDependencies: async () => {
        nowMs += 25;
        return false;
      },
      prepareStructureTriangles: async () => true,
      primeAudio: async () => undefined,
      spawnEntities: async () => undefined,
      finalize: async () => undefined,
    });

    expect(controller.getSummary()).toEqual({
      status: "idle",
      mapId: null,
      startedAtMs: null,
      completedAtMs: null,
      totalLoadTimeMs: null,
      firstVisibleFrameTimeMs: null,
      fullyReadyTimeMs: null,
      topPhases: [],
    });
    expect(controller.getPhases()).toEqual([]);

    controller.beginMapLoad("downtown");
    expect(controller.getSummary().status).toBe("running");
    expect(controller.getSummary().mapId).toBe("downtown");
    expect(controller.getPhases()).toHaveLength(7);
    expect(controller.getPhases().every((phase) => phase.status === "pending")).toBe(true);

    controller.tick();
    await Promise.resolve();
    await Promise.resolve();
    controller.tick();
    await Promise.resolve();
    await Promise.resolve();
    controller.tick();
    await Promise.resolve();
    await Promise.resolve();

    const summary = controller.getSummary();
    const phases = controller.getPhases();
    const prewarm = phases.find((phase) => phase.name === "PREWARM_DEPENDENCIES");

    expect(summary.status).toBe("running");
    expect(summary.totalLoadTimeMs).toBeNull();
    expect(summary.firstVisibleFrameTimeMs).toBeNull();
    expect(prewarm).toMatchObject({
      status: "running",
      attemptCount: 1,
      durationMs: 25,
    });
  });

  it("builds a completed summary, sorts top phases, and logs once after the first visible frame", async () => {
    const controller = createLoadingController({
      compileMap: async () => { nowMs += 10; },
      precomputeStaticMap: async () => { nowMs += 20; },
      prewarmDependencies: async () => {
        nowMs += 60;
        return true;
      },
      prepareStructureTriangles: async () => {
        nowMs += 30;
        return true;
      },
      primeAudio: async () => { nowMs += 15; },
      spawnEntities: async () => { nowMs += 5; },
      finalize: async () => { nowMs += 10; },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller);

    const summaryBeforeFrame = controller.getSummary();
    expect(summaryBeforeFrame).toMatchObject({
      status: "completed",
      mapId: "downtown",
      totalLoadTimeMs: 150,
      firstVisibleFrameTimeMs: null,
      fullyReadyTimeMs: null,
    });

    nowMs += 12;
    controller.markFirstVisibleFrame();

    const summary = controller.getSummary();
    expect(summary.firstVisibleFrameTimeMs).toBe(162);
    expect(summary.topPhases.map((phase) => phase.name).slice(0, 3)).toEqual([
      "PREWARM_DEPENDENCIES",
      "PREPARE_STRUCTURE_TRIANGLES",
      "PRECOMPUTE_STATIC_MAP",
    ]);
    expect(summary.topPhases[0]?.durationMs).toBe(60);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.debug).not.toHaveBeenCalled();

    const [summaryBlock] = vi.mocked(console.log).mock.calls[0];
    expect(summaryBlock).toContain("[LoadProfiler] Total: 150 ms");
    expect(summaryBlock).toContain("[LoadProfiler] FirstFrame: 162 ms");
    expect(summaryBlock).toContain("[LoadProfiler] FullyReady: n/a");

    controller.markFirstVisibleFrame();
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("records COMPILE_MAP child phases and prints a descending child breakdown", async () => {
    const controller = createLoadingController({
      compileMap: async () => {
        const endParse = beginLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.SOURCE_MAP_READ_OR_PARSE);
        nowMs += 35;
        endParse();

        const endStructure = beginLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.STRUCTURE_PLACEMENT);
        nowMs += 80;
        endStructure();

        const endTriangles = beginLoadProfilerSubphase(LOAD_PROFILER_SUBPHASE.TRIANGLE_GENERATION);
        nowMs += 20;
        endTriangles();

        nowMs += 5;
      },
      precomputeStaticMap: async () => { nowMs += 10; },
      prewarmDependencies: async () => {
        nowMs += 12;
        return true;
      },
      prepareStructureTriangles: async () => {
        nowMs += 8;
        return true;
      },
      primeAudio: async () => { nowMs += 6; },
      spawnEntities: async () => { nowMs += 4; },
      finalize: async () => { nowMs += 3; },
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller);

    nowMs += 7;
    controller.markFirstVisibleFrame();

    const compileMap = controller.getPhases().find((phase) => phase.name === "COMPILE_MAP");
    expect(compileMap?.durationMs).toBe(140);
    expect(compileMap?.children?.map((phase) => [phase.name, phase.durationMs])).toEqual([
      [LOAD_PROFILER_SUBPHASE.STRUCTURE_PLACEMENT, 80],
      [LOAD_PROFILER_SUBPHASE.SOURCE_MAP_READ_OR_PARSE, 35],
      [LOAD_PROFILER_SUBPHASE.TRIANGLE_GENERATION, 20],
    ]);

    const [summaryBlock] = vi.mocked(console.log).mock.calls[0];
    expect(summaryBlock).toContain("[LoadProfiler] COMPILE_MAP total: 140 ms");
    expect(summaryBlock).toContain("[LoadProfiler]   structure placement     80 ms");
    expect(summaryBlock).toContain("[LoadProfiler]   source map read / parse 35 ms");
    expect(summaryBlock).toContain("[LoadProfiler]   triangle generation     20 ms");
  });

  it("records fail-open metadata without reintroducing normal debug spam", async () => {
    let prewarmAttempts = 0;
    const controller = createLoadingController({
      compileMap: async () => { nowMs += 5; },
      precomputeStaticMap: async () => { nowMs += 5; },
      prewarmDependencies: async () => {
        prewarmAttempts++;
        nowMs += 50;
        return false;
      },
      prepareStructureTriangles: async () => true,
      primeAudio: async () => undefined,
      spawnEntities: async () => undefined,
      finalize: async () => undefined,
    });

    controller.beginMapLoad("downtown");
    await tickUntilDone(controller, 128);

    const prewarm = controller.getPhases().find((phase) => phase.name === "PREWARM_DEPENDENCIES");
    expect(prewarm).toMatchObject({
      status: "fail-open",
      attemptCount: 4,
      durationMs: 200,
      metadata: {
        mapId: "downtown",
        failOpenReason: "attempt-limit",
        attemptLimit: 4,
        elapsedLimitMs: 9000,
      },
    });
    expect(prewarmAttempts).toBe(4);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("formats summary blocks with stable prefixes and aligned phase durations", () => {
    const summary: LoadProfilerSummary = {
      status: "completed",
      mapId: "downtown",
      startedAtMs: 0,
      completedAtMs: 150,
      totalLoadTimeMs: 150,
      firstVisibleFrameTimeMs: 162,
      fullyReadyTimeMs: null,
      topPhases: [
        {
          name: "PREWARM_DEPENDENCIES",
          stage: "PREWARM_DEPENDENCIES",
          order: 2,
          status: "completed",
          durationMs: 60,
          attemptCount: 1,
          startedAtMs: 30,
          endedAtMs: 90,
          metadata: { mapId: "downtown" },
        },
        {
          name: "FINALIZE",
          stage: "FINALIZE",
          order: 6,
          status: "completed",
          durationMs: 10,
          attemptCount: 1,
          startedAtMs: 140,
          endedAtMs: 150,
          metadata: { mapId: "downtown" },
        },
      ],
    };

    expect(formatLoadProfilerSummaryBlock(summary)).toBe([
      "[LoadProfiler] Total: 150 ms",
      "[LoadProfiler] FirstFrame: 162 ms",
      "[LoadProfiler] FullyReady: n/a",
      "[LoadProfiler] Top phases:",
      "[LoadProfiler]   PREWARM_DEPENDENCIES 60 ms",
      "[LoadProfiler]   FINALIZE             10 ms",
    ].join("\n"));
  });

  it("formats COMPILE_MAP child phases beneath the top-level summary", () => {
    const summary: LoadProfilerSummary = {
      status: "completed",
      mapId: "downtown",
      startedAtMs: 0,
      completedAtMs: 150,
      totalLoadTimeMs: 150,
      firstVisibleFrameTimeMs: 162,
      fullyReadyTimeMs: null,
      topPhases: [
        {
          name: "COMPILE_MAP",
          stage: "COMPILE_MAP",
          order: 0,
          status: "completed",
          durationMs: 140,
          attemptCount: 1,
          startedAtMs: 0,
          endedAtMs: 140,
          metadata: { mapId: "downtown" },
        },
      ],
    };

    expect(formatLoadProfilerSummaryBlock(summary, [
      {
        name: "COMPILE_MAP",
        stage: "COMPILE_MAP",
        order: 0,
        status: "completed",
        durationMs: 140,
        attemptCount: 1,
        startedAtMs: 0,
        endedAtMs: 140,
        metadata: { mapId: "downtown" },
        children: [
          {
            name: LOAD_PROFILER_SUBPHASE.STRUCTURE_PLACEMENT,
            stage: LOAD_PROFILER_SUBPHASE.STRUCTURE_PLACEMENT,
            order: 0,
            status: "completed",
            durationMs: 80,
            attemptCount: 1,
            startedAtMs: 35,
            endedAtMs: 115,
          },
          {
            name: LOAD_PROFILER_SUBPHASE.SOURCE_MAP_READ_OR_PARSE,
            stage: LOAD_PROFILER_SUBPHASE.SOURCE_MAP_READ_OR_PARSE,
            order: 1,
            status: "completed",
            durationMs: 35,
            attemptCount: 1,
            startedAtMs: 0,
            endedAtMs: 35,
          },
        ],
      },
    ])).toBe([
      "[LoadProfiler] Total: 150 ms",
      "[LoadProfiler] FirstFrame: 162 ms",
      "[LoadProfiler] FullyReady: n/a",
      "[LoadProfiler] Top phases:",
      "[LoadProfiler]   COMPILE_MAP 140 ms",
      "[LoadProfiler] COMPILE_MAP total: 140 ms",
      "[LoadProfiler]   structure placement     80 ms",
      "[LoadProfiler]   source map read / parse 35 ms",
    ].join("\n"));
  });
});
