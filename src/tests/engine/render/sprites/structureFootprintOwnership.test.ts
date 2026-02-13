import { describe, expect, it } from "vitest";
import {
  anchorToBaseTile,
  orientedDims,
  ownerTileForBandFromSE,
} from "../../../../engine/render/sprites/structureFootprintOwnership";

describe("structureFootprintOwnership", () => {
  it("orients footprint by swapping width and height only when flipped", () => {
    expect(orientedDims(3, 2, false)).toEqual({ w: 3, h: 2 });
    expect(orientedDims(3, 2, true)).toEqual({ w: 2, h: 3 });
  });

  it("converts bottom-right anchors into top-left canonical base tiles", () => {
    expect(anchorToBaseTile(4, 3, 3, 2, "BOTTOM_RIGHT")).toEqual({ baseTx: 2, baseTy: 2 });
    expect(anchorToBaseTile(1, 4, 2, 3, "BOTTOM_RIGHT")).toEqual({ baseTx: 0, baseTy: 2 });
  });

  it("maps owner tiles by walking west on south edge then north on east edge from SE", () => {
    const owners32 = Array.from({ length: 5 }, (_, i) => ownerTileForBandFromSE(2, 1, 3, 2, i));
    expect(owners32).toEqual([
      { tx: 2, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 0, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 0 },
    ]);

    const owners23 = Array.from({ length: 5 }, (_, i) => ownerTileForBandFromSE(1, 2, 2, 3, i));
    expect(owners23).toEqual([
      { tx: 1, ty: 2 },
      { tx: 0, ty: 2 },
      { tx: 1, ty: 2 },
      { tx: 1, ty: 1 },
      { tx: 1, ty: 0 },
    ]);
  });
});
