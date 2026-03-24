import { describe, expect, it } from "vitest";
import { buildMonolithicBuildingSemanticGeometryFromAlphaMap } from "../../../game/structures/monolithicBuildingSemanticPrepass";
import { getDowntown2MonolithicAlphaMap } from "../../../game/content/monolithicBuildingAlphaDowntown2";

describe("monolithicBuildingSemanticPrepass", () => {
  it("derives deterministic downtown_2 semantic geometry from monolithic alpha data", () => {
    const alphaMap = getDowntown2MonolithicAlphaMap();

    const first = buildMonolithicBuildingSemanticGeometryFromAlphaMap(
      "downtown_2",
      "structures/buildings/downtown/2",
      alphaMap,
      { heightUnits: 32 },
    );
    const second = buildMonolithicBuildingSemanticGeometryFromAlphaMap(
      "downtown_2",
      "structures/buildings/downtown/2",
      alphaMap,
      { heightUnits: 32 },
    );

    expect(first).toEqual(second);
    expect(first?.n).toBe(4);
    expect(first?.m).toBe(4);
    expect(first?.heightUnits).toBe(32);
    expect(first?.anchorSpriteLocal).toBeTruthy();
    expect(first?.sliceEntries.length).toBeGreaterThan(0);
  });
});
