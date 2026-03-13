import { describe, expect, it } from "vitest";
import {
  buildFrameWorldLightRegistry,
} from "../../../../game/systems/presentation/worldLightRenderPieces";

describe("worldLightRenderPieces", () => {
  const paramsBase = {
    mapId: "test_map",
    tileWorld: 64,
    elevPx: 16,
    worldScale: 2,
    streetLampOcclusionEnabled: true,
    tileHeightAtWorld: () => 0,
    isTileInRenderRadius: () => true,
    projectToScreen: (worldX: number, worldY: number, zPx: number) => ({
      x: worldX + zPx * 0.1,
      y: worldY - zPx * 0.2,
    }),
  } as const;

  it("builds a LIGHT render piece from support/source anchor for street lamps", () => {
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:lamp:1",
        worldX: 64,
        worldY: 128,
        supportHeightUnits: 1,
        heightUnits: 5,
        intensity: 0.8,
        radiusPx: 100,
        shape: "STREET_LAMP",
      }],
      runtimeBeam: null,
    });

    expect(registry.lights).toHaveLength(1);
    expect(registry.renderPieces).toHaveLength(1);
    const light = registry.lights[0];
    const piece = registry.renderPieces[0];
    expect(light.anchorTx).toBe(1);
    expect(light.anchorTy).toBe(2);
    expect(light.anchorZ).toBe(1);
    expect(light.projected.lightZ).toBe(1);
    expect(light.projected.radiusPx).toBe(200);
    expect(piece.kind).toBe("LIGHT");
    expect(piece.baseZ).toBe(1);
    expect(piece.slice).toBe(3);
    expect(piece.within).toBe(1);
  });

  it("keeps RADIAL projected height while sorting from support anchor", () => {
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:radial:1",
        worldX: 96,
        worldY: 32,
        supportHeightUnits: 2,
        heightUnits: 7,
        intensity: 0.7,
        radiusPx: 80,
        shape: "RADIAL",
      }],
      runtimeBeam: null,
    });

    expect(registry.lights).toHaveLength(1);
    expect(registry.lights[0].anchorZ).toBe(2);
    expect(registry.lights[0].projected.lightZ).toBe(7);
    expect(registry.renderPieces[0].baseZ).toBe(2);
  });

  it("registers runtime beam lights with deterministic LIGHT ids and keys", () => {
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [],
      runtimeBeam: {
        active: true,
        startWorldX: 0,
        startWorldY: 0,
        endWorldX: 300,
        endWorldY: 0,
        zVisual: 3,
        widthPx: 6,
        glowIntensity: 1,
      },
    });

    expect(registry.lights).toHaveLength(3);
    expect(registry.renderPieces).toHaveLength(3);
    expect(registry.lights.map((l) => l.id)).toEqual([
      "runtime:beam:0",
      "runtime:beam:1",
      "runtime:beam:2",
    ]);
    expect(registry.renderPieces.every((p) => p.kind === "LIGHT")).toBe(true);
    expect(registry.renderPieces.every((p) => p.baseZ === 3)).toBe(true);
  });
});
