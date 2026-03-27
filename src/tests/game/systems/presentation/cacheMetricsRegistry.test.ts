import { describe, expect, it } from "vitest";
import { CacheMetricsRegistry } from "../../../../game/systems/presentation/cacheMetricsRegistry";

describe("cacheMetricsRegistry", () => {
  it("aggregates registered cache samples into a normalized snapshot", () => {
    const registry = new CacheMetricsRegistry();
    registry.register({
      name: "alpha",
      budgetBytes: 4 * 1024,
      sample: () => ({
        name: "alpha",
        kind: "derived",
        entryCount: 2,
        approxBytes: 1024,
        hits: 5,
        misses: 1,
        inserts: 2,
        evictions: 0,
        clears: 0,
        bounded: true,
        hasEviction: false,
      }),
    });
    registry.register({
      name: "beta",
      sample: () => ({
        name: "beta",
        kind: "scene",
        entryCount: 3,
        approxBytes: null,
        hits: 0,
        misses: 2,
        inserts: 1,
        evictions: 0,
        clears: 1,
        bounded: false,
        hasEviction: false,
      }),
    });

    const snapshot = registry.sample();

    expect(snapshot.totalEntries).toBe(5);
    expect(snapshot.totalKnownBytes).toBe(1024);
    expect(snapshot.totalHits).toBe(5);
    expect(snapshot.totalMisses).toBe(3);
    expect(snapshot.totalInserts).toBe(3);
    expect(snapshot.totalClears).toBe(1);
    expect(snapshot.totalBudgetBytes).toBe(4 * 1024);
    expect(snapshot.caches.map((cache) => cache.name)).toEqual(["alpha", "beta"]);
    expect(snapshot.caches.find((cache) => cache.name === "alpha")?.status).toBe("stable");
    expect(snapshot.caches.find((cache) => cache.name === "beta")?.status).toBe("unknown");
  });

  it("classifies stable growing and warning cache states", () => {
    const registry = new CacheMetricsRegistry();
    let bytes = 1024;
    registry.register({
      name: "growth",
      budgetBytes: 256 * 1024,
      sample: () => ({
        name: "growth",
        kind: "derived",
        entryCount: 1,
        approxBytes: bytes,
        hits: 0,
        misses: 0,
        inserts: 1,
        evictions: 0,
        clears: 0,
        bounded: true,
        hasEviction: false,
      }),
    });

    expect(registry.sample().caches[0].status).toBe("stable");
    bytes = 1024 + 128 * 1024;
    expect(registry.sample().caches[0].status).toBe("growing");
    bytes = 512 * 1024;
    expect(registry.sample().caches[0].status).toBe("warning");
  });
});
