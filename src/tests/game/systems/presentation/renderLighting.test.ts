import { describe, expect, it } from "vitest";
import { resolveAdditionalDarknessAlphaForMax } from "../../../../game/systems/presentation/renderLighting";

describe("renderLighting", () => {
  it("returns no additional alpha when ambient darkness already covers the cast shadow", () => {
    expect(resolveAdditionalDarknessAlphaForMax(0.2, 0.4)).toBe(0);
    expect(resolveAdditionalDarknessAlphaForMax(0.4, 0.4)).toBe(0);
  });

  it("returns the exact extra alpha needed to stack to the max darkness", () => {
    const extraAlpha = resolveAdditionalDarknessAlphaForMax(0.6, 0.25);
    const finalDarkness = 1 - ((1 - 0.25) * (1 - extraAlpha));

    expect(finalDarkness).toBeCloseTo(0.6, 6);
  });
});
