import { describe, expect, it } from "vitest";
import { buildPaletteVariantKey } from "../../../game/render/activePalette";

describe("activePalette variant key", () => {
  it("includes saturation and darkness tokens", () => {
    const key = buildPaletteVariantKey("cyberpunk", {
      sWeightPercent: 25,
      darknessPercent: 75,
    });
    expect(key).toBe("cyberpunk@@sw:25@@dk:75");
  });

  it("changes when darkness changes", () => {
    const a = buildPaletteVariantKey("db32", {
      sWeightPercent: 50,
      darknessPercent: 0,
    });
    const b = buildPaletteVariantKey("db32", {
      sWeightPercent: 50,
      darknessPercent: 50,
    });
    expect(a).not.toBe(b);
    expect(a).toBe("db32@@sw:50@@dk:0");
    expect(b).toBe("db32@@sw:50@@dk:50");
  });
});
