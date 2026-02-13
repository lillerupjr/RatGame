import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureBandPieces,
  clearRuntimeStructureSliceCache,
  DEFAULT_STRUCTURE_BAND_PX,
  getStructureBandOwnerTile,
  getVerticalBandLayout,
} from "../../../../engine/render/sprites/runtimeStructureSlicing";
import { registerSpriteMeta } from "../../../../engine/render/sprites/spriteMeta";

describe("runtimeStructureSlicing", () => {
  it("maps ownership tiles along south edge then east edge with duplicated SE corner", () => {
    const owners = Array.from({ length: 5 }, (_, i) => getStructureBandOwnerTile(0, 0, 3, 2, i));
    expect(owners).toEqual([
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 0 },
    ]);
  });

  it("uses side padding bands (+2) when sprite width exceeds core width", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_band_count", {
      tileWidth: 2,
      tileHeight: 3,
      zHeight: 1,
    });
    const spriteW = 420;
    const coreCount = 5;
    const bands = getVerticalBandLayout("structures/buildings/test/runtime_band_count", spriteW, 150, DEFAULT_STRUCTURE_BAND_PX);

    expect(bands).toHaveLength(7);
    expect(bands.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(bands.map((b) => b.srcRect.x)).toEqual([0, 50, 114, 178, 242, 306, 370]);
    expect(bands.map((b) => b.srcRect.w)).toEqual([50, 64, 64, 64, 64, 64, 50]);
    expect(bands.every((b) => b.srcRect.h === 150)).toBe(true);

    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "runtime_band_count_A",
      spriteId: "structures/buildings/test/runtime_band_count",
      tx: 0,
      ty: 0,
      baseZ: 1,
      baseDx: 100,
      baseDy: 20,
      spriteWidth: spriteW,
      spriteHeight: 120,
      bandPx: 64,
      sliceStride: 1,
      scale: 1,
    });
    expect(pieces).toHaveLength(7);
    expect(pieces.map((p) => p.dstRect.x)).toEqual([100, 150, 214, 278, 342, 406, 470]);
  });

  it("maps padding bands to first/last core owner tiles", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_padding_owner", {
      tileWidth: 2,
      tileHeight: 3,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "building_A",
      spriteId: "structures/buildings/test/runtime_padding_owner",
      tx: 0,
      ty: 0,
      baseZ: 3,
      baseDx: 100,
      baseDy: 200,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      sliceStride: 2,
      scale: 1,
    });

    const byIndex = new Map(pieces.map((p) => [p.index, p] as const));
    const leftPad = byIndex.get(0)!;
    const firstCore = byIndex.get(1)!;
    const lastCore = byIndex.get(5)!;
    const rightPad = byIndex.get(6)!;

    expect(leftPad.renderKey.slice).toBe(firstCore.renderKey.slice);
    expect(leftPad.renderKey.within).toBe(firstCore.renderKey.within);
    expect(rightPad.renderKey.slice).toBe(lastCore.renderKey.slice);
    expect(rightPad.renderKey.within).toBe(lastCore.renderKey.within);
    expect(pieces.every((p) => p.renderKey.baseZ === 3)).toBe(true);

    const stableIds = pieces.map((p) => p.renderKey.stableId);
    expect(new Set(stableIds).size).toBe(stableIds.length);
  });

  it("never maps padding owners outside the footprint", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_footprint_bounds", {
      tileWidth: 2,
      tileHeight: 3,
      zHeight: 1,
    });
    const tx = 5;
    const ty = 5;
    const w = 2;
    const h = 3;
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "bounds_A",
      spriteId: "structures/buildings/test/runtime_footprint_bounds",
      tx,
      ty,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
    });

    expect(pieces).toHaveLength(7);
    for (const piece of pieces) {
      const ownerTx = piece.renderKey.within;
      const ownerTy = piece.renderKey.slice - ownerTx;
      expect(ownerTx).toBeGreaterThanOrEqual(tx);
      expect(ownerTx).toBeLessThanOrEqual(tx + w - 1);
      expect(ownerTy).toBeGreaterThanOrEqual(ty);
      expect(ownerTy).toBeLessThanOrEqual(ty + h - 1);
    }
  });

  it("places each band at baseDx + srcX*scale when sliceOffsetX is zero", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_dst_x_base", {
      tileWidth: 2,
      tileHeight: 3,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "dst_x_base",
      spriteId: "structures/buildings/test/runtime_dst_x_base",
      tx: 0,
      ty: 0,
      baseZ: 0,
      baseDx: 10,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 2,
      sliceOffsetX: 0,
    });

    for (const piece of pieces) {
      expect(piece.dstRect.x).toBe(10 + piece.srcRect.x * 2);
    }
  });

  it("applies sliceOffsetX as a uniform unscaled shift to all bands", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_dst_x_offset", {
      tileWidth: 2,
      tileHeight: 3,
      zHeight: 1,
    });
    const input = {
      structureInstanceId: "dst_x_offset",
      spriteId: "structures/buildings/test/runtime_dst_x_offset",
      tx: 0,
      ty: 0,
      baseZ: 0,
      baseDx: 10,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 2,
    };
    const withoutOffset = buildRuntimeStructureBandPieces({
      ...input,
      sliceOffsetX: 0,
    });
    const withOffset = buildRuntimeStructureBandPieces({
      ...input,
      sliceOffsetX: 13,
    });

    expect(withOffset).toHaveLength(withoutOffset.length);
    for (let i = 0; i < withOffset.length; i++) {
      expect(withOffset[i].dstRect.x - withoutOffset[i].dstRect.x).toBe(13);
    }
  });
});
