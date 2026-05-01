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

  it("maps owner tiles uniquely by walking east on south edge then north on east edge from SW->SE progression", () => {
    const owners32 = Array.from({ length: 5 }, (_, i) => ownerTileForBandFromSE(2, 1, 3, 2, i));
    expect(owners32).toEqual([
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 0 },
      { tx: 2, ty: -1 },
    ]);

    const owners23 = Array.from({ length: 5 }, (_, i) => ownerTileForBandFromSE(1, 2, 2, 3, i));
    expect(owners23).toEqual([
      { tx: 0, ty: 2 },
      { tx: 1, ty: 2 },
      { tx: 1, ty: 1 },
      { tx: 1, ty: 0 },
      { tx: 1, ty: -1 },
    ]);
  });

  it("extends ownership progression beyond footprint with virtual overflow anchors", () => {
    const owners = Array.from({ length: 7 }, (_, i) => ownerTileForBandFromSE(5, 5, 2, 2, i - 1));
    expect(owners).toEqual([
      { tx: 3, ty: 5 }, // left overflow
      { tx: 4, ty: 5 }, // SW
      { tx: 5, ty: 5 }, // SE
      { tx: 5, ty: 4 }, // NE
      { tx: 5, ty: 3 }, // north overflow
      { tx: 5, ty: 2 }, // north overflow
      { tx: 5, ty: 1 }, // north overflow
    ]);
  });
});
