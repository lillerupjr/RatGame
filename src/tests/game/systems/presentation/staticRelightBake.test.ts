import { describe, expect, it } from "vitest";
import {
  buildStaticRelightBakeContextKey,
  buildStaticRelightPieceKey,
  StaticRelightBakeStore,
} from "../../../../game/systems/presentation/staticRelightBake";
import type { StaticRelightLightCandidate } from "../../../../game/systems/presentation/staticRelightPoc";

function makeLights(): StaticRelightLightCandidate[] {
  return [
    {
      id: "lamp_a",
      tileX: 10,
      tileY: 12,
      centerX: 256,
      centerY: 180,
      radiusPx: 140,
      yScale: 0.7,
      intensity: 0.84,
    },
    {
      id: "lamp_b",
      tileX: 5,
      tileY: 6,
      centerX: 140,
      centerY: 96,
      radiusPx: 110,
      yScale: 0.65,
      intensity: 0.65,
    },
  ];
}

describe("staticRelightBake", () => {
  it("changes context key when relevant bake inputs change", () => {
    const base = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "live",
      paletteSelectionId: "fiery_plague_gb",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 75,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });

    const mapChanged = buildStaticRelightBakeContextKey({
      mapId: "china_town",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "live",
      paletteSelectionId: "fiery_plague_gb",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 75,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });
    const strengthChanged = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "live",
      paletteSelectionId: "fiery_plague_gb",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 50,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });
    const targetChanged = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "live",
      paletteSelectionId: "fiery_plague_gb",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 75,
      staticRelightTargetDarknessPercent: 25,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });
    const lightOverrideChanged = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "live",
      paletteSelectionId: "fiery_plague_gb",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 75,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "palette",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });
    const paletteSelectionChanged = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      staticRelightPocEnabled: true,
      paletteId: "fiery_plague_gb",
      paletteVariantKey: "fiery_plague_gb@@sw:75@@dk:100",
      paletteSwapEnabled: true,
      paletteGroup: "modded",
      paletteSelectionId: "cga_mono",
      saturationWeightPercent: 75,
      darknessPercent: 100,
      baseDarknessBucket: 100,
      staticRelightStrengthPercent: 75,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: makeLights(),
    });

    expect(mapChanged).not.toBe(base);
    expect(strengthChanged).not.toBe(base);
    expect(targetChanged).not.toBe(base);
    expect(lightOverrideChanged).not.toBe(base);
    expect(paletteSelectionChanged).not.toBe(base);
  });

  it("keeps context key stable for equivalent quantized lights", () => {
    const lightsA: StaticRelightLightCandidate[] = [
      {
        id: "lamp_same",
        tileX: 3,
        tileY: 4,
        centerX: 100.1,
        centerY: 200.1,
        radiusPx: 80.1,
        yScale: 0.703,
        intensity: 0.804,
      },
    ];
    const lightsB: StaticRelightLightCandidate[] = [
      {
        id: "lamp_same",
        tileX: 3,
        tileY: 4,
        centerX: 100.2,
        centerY: 200.2,
        radiusPx: 80.2,
        yScale: 0.704,
        intensity: 0.802,
      },
    ];

    const keyA = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: lightsA,
    });
    const keyB = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: lightsB,
    });

    expect(keyB).toBe(keyA);
  });

  it("does not invalidate context key from projected-center-only light changes", () => {
    const lightsA: StaticRelightLightCandidate[] = [
      {
        id: "lamp_same",
        tileX: 8,
        tileY: 9,
        centerX: 64,
        centerY: 64,
        radiusPx: 120,
        yScale: 0.7,
        intensity: 0.8,
      },
    ];
    const lightsB: StaticRelightLightCandidate[] = [
      {
        id: "lamp_same",
        tileX: 8,
        tileY: 9,
        centerX: 1064,
        centerY: -936,
        radiusPx: 120,
        yScale: 0.7,
        intensity: 0.8,
      },
    ];

    const keyA = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: lightsA,
    });
    const keyB = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: lightsB,
    });

    expect(keyB).toBe(keyA);
  });

  it("keeps context key stable when light ordering changes", () => {
    const ordered = makeLights();
    const reversed = [ordered[1], ordered[0]];
    const keyA = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: ordered,
    });
    const keyB = buildStaticRelightBakeContextKey({
      mapId: "downtown",
      relightEnabled: true,
      paletteId: "db32",
      saturationWeightPercent: 50,
      darknessPercent: 75,
      baseDarknessBucket: 75,
      staticRelightStrengthPercent: 100,
      staticRelightTargetDarknessPercent: 50,
      lightColorModeOverride: "authored",
      lightStrengthOverride: "authored",
      lights: reversed,
    });
    expect(keyB).toBe(keyA);
  });

  it("builds deterministic piece keys", () => {
    const keyA = buildStaticRelightPieceKey({
      kind: "FLOOR_TOP",
      parts: [10, 20, 3, "sidewalk", 2, 1],
    });
    const keyB = buildStaticRelightPieceKey({
      kind: "FLOOR_TOP",
      parts: [10, 20, 3, "sidewalk", 2, 1],
    });
    const keyC = buildStaticRelightPieceKey({
      kind: "DECAL_TOP",
      parts: [10, 20, 3, "sidewalk", 2, 1],
    });

    expect(keyB).toBe(keyA);
    expect(keyC).not.toBe(keyA);
  });

  it("supports direct pre-baked entry writes via set/get", () => {
    const store = new StaticRelightBakeStore<number>();
    store.resetIfContextChanged("ctx:prebake");
    store.set("piece:base", { kind: "BASE" });
    store.set("piece:relit", { kind: "RELIT", baked: 7 });
    expect(store.get("piece:base")).toEqual({ kind: "BASE" });
    expect(store.get("piece:relit")).toEqual({ kind: "RELIT", baked: 7 });
  });

  it("bakes once and reuses cache entry for subsequent draws", () => {
    const store = new StaticRelightBakeStore<number>();
    store.resetIfContextChanged("ctx:a");
    let bakeCalls = 0;

    const entryA = store.getOrBake("piece:1", () => {
      bakeCalls += 1;
      return { kind: "RELIT", baked: 42 };
    });
    const entryB = store.getOrBake("piece:1", () => {
      bakeCalls += 1;
      return { kind: "RELIT", baked: 11 };
    });

    expect(bakeCalls).toBe(1);
    expect(entryA).toEqual({ kind: "RELIT", baked: 42 });
    expect(entryB).toEqual({ kind: "RELIT", baked: 42 });
  });

  it("stores BASE sentinel for unlit pieces and skips repeat bake work", () => {
    const store = new StaticRelightBakeStore<number>();
    store.resetIfContextChanged("ctx:a");
    let bakeCalls = 0;

    const entryA = store.getOrBake("piece:base", () => {
      bakeCalls += 1;
      return { kind: "BASE" };
    });
    const entryB = store.getOrBake("piece:base", () => {
      bakeCalls += 1;
      return { kind: "RELIT", baked: 999 };
    });

    expect(bakeCalls).toBe(1);
    expect(entryA).toEqual({ kind: "BASE" });
    expect(entryB).toEqual({ kind: "BASE" });
  });

  it("invalidates cached entries when context key changes", () => {
    const store = new StaticRelightBakeStore<number>();
    store.resetIfContextChanged("ctx:a");
    store.getOrBake("piece:1", () => ({ kind: "RELIT", baked: 1 }));
    expect(store.get("piece:1")).toEqual({ kind: "RELIT", baked: 1 });

    const changed = store.resetIfContextChanged("ctx:b");
    expect(changed).toBe(true);
    expect(store.get("piece:1")).toBeUndefined();

    const unchanged = store.resetIfContextChanged("ctx:b");
    expect(unchanged).toBe(false);
  });
});
