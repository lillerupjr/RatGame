import { describe, expect, it } from "vitest";
import {
  buildFrameWorldLightRegistry,
} from "../../../../game/systems/presentation/worldLightRenderPieces";
import {
  DEFAULT_STANDARD_LIGHT_COLOR,
  resolvePaletteLightTint,
} from "../../../../game/systems/presentation/lightColorResolution";

describe("worldLightRenderPieces", () => {
  const paramsBase = {
    mapId: "test_map",
    tileWorld: 64,
    elevPx: 16,
    worldScale: 2,
    streetLampOcclusionEnabled: true,
    staticLightCycleOverride: "automatic",
    shadowSunTimeHour: 20,
    lightOverrides: {
      colorModeOverride: "authored",
      strengthOverride: "authored",
    },
    lightPalette: {
      paletteId: "db32",
      saturationWeight: 0,
    },
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

  it("skips static lights with off color mode", () => {
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:off:1",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
        colorMode: "off",
      }],
      runtimeBeam: null,
    });

    expect(registry.lights).toHaveLength(0);
    expect(registry.renderPieces).toHaveLength(0);
    expect(registry.projectedLights).toHaveLength(0);
  });

  it("uses the automatic light schedule for static lights", () => {
    const dayRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      shadowSunTimeHour: 13,
      staticLights: [{
        id: "map:auto:day",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
      }],
      runtimeBeam: null,
    });
    expect(dayRegistry.lights).toHaveLength(0);

    const eveningRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      shadowSunTimeHour: 17,
      staticLights: [{
        id: "map:auto:evening",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
      }],
      runtimeBeam: null,
    });
    expect(eveningRegistry.lights).toHaveLength(1);

    const morningRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      shadowSunTimeHour: 9,
      staticLights: [{
        id: "map:auto:morning",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
      }],
      runtimeBeam: null,
    });
    expect(morningRegistry.lights).toHaveLength(0);
  });

  it("honors explicit static light on/off overrides", () => {
    const onRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      shadowSunTimeHour: 13,
      staticLightCycleOverride: "on",
      staticLights: [{
        id: "map:override:on",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
      }],
      runtimeBeam: null,
    });
    expect(onRegistry.lights).toHaveLength(1);

    const offRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      shadowSunTimeHour: 20,
      staticLightCycleOverride: "off",
      staticLights: [{
        id: "map:override:off",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.9,
        radiusPx: 90,
      }],
      runtimeBeam: null,
    });
    expect(offRegistry.lights).toHaveLength(0);
  });

  it("uses standard yellow tint and ignores authored color in standard mode", () => {
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:standard:1",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.6,
        radiusPx: 90,
        colorMode: "standard",
        color: "#00FF00",
      }],
      runtimeBeam: null,
    });

    expect(registry.lights).toHaveLength(1);
    expect(registry.lights[0].projected.color).toBe(DEFAULT_STANDARD_LIGHT_COLOR);
  });

  it("applies strength multipliers to intensity", () => {
    const low = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:strength:low",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 1,
        radiusPx: 80,
        strength: "low",
      }],
      runtimeBeam: null,
    });
    const medium = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:strength:medium",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 1,
        radiusPx: 80,
        strength: "medium",
      }],
      runtimeBeam: null,
    });
    const high = buildFrameWorldLightRegistry({
      ...paramsBase,
      staticLights: [{
        id: "map:strength:high",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 1,
        radiusPx: 80,
        strength: "high",
      }],
      runtimeBeam: null,
    });

    expect(low.lights[0].projected.intensity).toBeCloseTo(0.75);
    expect(medium.lights[0].projected.intensity).toBeCloseTo(1);
    expect(high.lights[0].projected.intensity).toBeCloseTo(1.25);
  });

  it("resolves palette mode tint from active palette hue anchors and saturation weight", () => {
    const paletteId = "db32";
    const saturationWeight = 1;
    const authoredColor = "#4FA8FF";
    const registry = buildFrameWorldLightRegistry({
      ...paramsBase,
      lightPalette: {
        paletteId,
        saturationWeight,
      },
      staticLights: [{
        id: "map:palette:1",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.6,
        radiusPx: 90,
        colorMode: "palette",
        color: authoredColor,
      }],
      runtimeBeam: null,
    });

    expect(registry.lights).toHaveLength(1);
    expect(registry.lights[0].projected.color).toBe(resolvePaletteLightTint({
      authoredColor,
      paletteId,
      saturationWeight,
    }));
  });

  it("applies forced global light mode overrides to static lights", () => {
    const offRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      lightOverrides: {
        colorModeOverride: "off",
        strengthOverride: "authored",
      },
      staticLights: [{
        id: "map:override:off",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.5,
        radiusPx: 70,
        colorMode: "palette",
        color: "#FF00FF",
      }],
      runtimeBeam: null,
    });
    expect(offRegistry.lights).toHaveLength(0);

    const standardRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      lightOverrides: {
        colorModeOverride: "standard",
        strengthOverride: "authored",
      },
      staticLights: [{
        id: "map:override:standard",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.5,
        radiusPx: 70,
        colorMode: "palette",
        color: "#FF00FF",
      }],
      runtimeBeam: null,
    });
    expect(standardRegistry.lights).toHaveLength(1);
    expect(standardRegistry.lights[0].projected.color).toBe(DEFAULT_STANDARD_LIGHT_COLOR);
  });

  it("applies forced global light strength override to static lights only", () => {
    const staticRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      lightOverrides: {
        colorModeOverride: "authored",
        strengthOverride: "high",
      },
      staticLights: [{
        id: "map:override:strength",
        worldX: 64,
        worldY: 64,
        heightUnits: 2,
        intensity: 0.8,
        radiusPx: 90,
        strength: "low",
      }],
      runtimeBeam: null,
    });
    expect(staticRegistry.lights).toHaveLength(1);
    expect(staticRegistry.lights[0].projected.intensity).toBeCloseTo(1);

    const beamRegistry = buildFrameWorldLightRegistry({
      ...paramsBase,
      lightOverrides: {
        colorModeOverride: "off",
        strengthOverride: "high",
      },
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
    expect(beamRegistry.lights).toHaveLength(3);
    expect(beamRegistry.lights.every((l) => l.source === "RUNTIME_BEAM")).toBe(true);
  });
});
