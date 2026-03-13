import { describe, expect, it } from "vitest";
import {
  PALETTES,
  getFirstPaletteInGroup,
  getNextPaletteInGroup,
  getPalettesByGroup,
} from "../../../../engine/render/palette/palettes";

describe("palette groups", () => {
  it("assigns all palettes to a valid group", () => {
    for (let i = 0; i < PALETTES.length; i++) {
      const group = PALETTES[i].group;
      expect(group === "live" || group === "test").toBe(true);
    }
  });

  it("includes the locked Lospec additions in the test group", () => {
    const ids = getPalettesByGroup("test").map((palette) => palette.id);
    expect(ids).toEqual(["midnight_ablaze", "blessing", "hollow", "berry_nebula", "cyclope6"]);
  });

  it("cycles to the next palette within the selected group", () => {
    const live = getPalettesByGroup("live");
    const first = getFirstPaletteInGroup("live");
    const next = getNextPaletteInGroup(first.id, "live");
    const wrapped = getNextPaletteInGroup(live[live.length - 1].id, "live");

    expect(live.length).toBeGreaterThan(1);
    expect(next.id).toBe(live[1].id);
    expect(wrapped.id).toBe(first.id);
  });
});
