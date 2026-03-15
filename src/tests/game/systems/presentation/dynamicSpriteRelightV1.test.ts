import { describe, expect, it } from "vitest";
import {
  computeNearestDynamicRelightAlpha,
  type DynamicRelightLightCandidate,
} from "../../../../game/systems/presentation/dynamicSpriteRelightV1";

describe("dynamicSpriteRelightV1", () => {
  it("returns null when no nearby light influences the sprite", () => {
    const lights: DynamicRelightLightCandidate[] = [
      { id: "far", centerX: 500, centerY: 500, radiusPx: 64, intensity: 1, yScale: 1 },
    ];
    const result = computeNearestDynamicRelightAlpha({
      screenX: 100,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0.04,
    });
    expect(result).toBeNull();
  });

  it("returns non-zero alpha when a nearby light exists", () => {
    const lights: DynamicRelightLightCandidate[] = [
      { id: "near", centerX: 120, centerY: 100, radiusPx: 80, intensity: 0.8, yScale: 1 },
    ];
    const result = computeNearestDynamicRelightAlpha({
      screenX: 100,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0.04,
    });
    expect(result).not.toBeNull();
    expect((result?.alpha ?? 0) > 0).toBe(true);
  });

  it("increases alpha when the sprite is closer to the same light", () => {
    const lights: DynamicRelightLightCandidate[] = [
      { id: "lamp", centerX: 100, centerY: 100, radiusPx: 100, intensity: 1, yScale: 1 },
    ];
    const near = computeNearestDynamicRelightAlpha({
      screenX: 105,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0,
    });
    const far = computeNearestDynamicRelightAlpha({
      screenX: 180,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0,
    });
    expect((near?.alpha ?? 0) > (far?.alpha ?? 0)).toBe(true);
  });

  it("uses nearest relevant light when multiple lights overlap", () => {
    const lights: DynamicRelightLightCandidate[] = [
      { id: "near", centerX: 112, centerY: 100, radiusPx: 90, intensity: 0.5, yScale: 1 },
      { id: "far", centerX: 180, centerY: 100, radiusPx: 140, intensity: 1, yScale: 1 },
    ];
    const result = computeNearestDynamicRelightAlpha({
      screenX: 100,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0,
    });
    expect(result?.lightId).toBe("near");
  });

  it("ignores zero or negative intensity lights", () => {
    const lights: DynamicRelightLightCandidate[] = [
      { id: "zero", centerX: 100, centerY: 100, radiusPx: 100, intensity: 0, yScale: 1 },
      { id: "negative", centerX: 102, centerY: 100, radiusPx: 100, intensity: -1, yScale: 1 },
    ];
    const result = computeNearestDynamicRelightAlpha({
      screenX: 100,
      screenY: 100,
      lights,
      strengthScale: 1,
      minAlpha: 0,
    });
    expect(result).toBeNull();
  });
});
