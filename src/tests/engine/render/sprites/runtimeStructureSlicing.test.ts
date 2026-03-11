import { describe, expect, it } from "vitest";
import {
  buildRuntimeStructureBandPieces,
  clearRuntimeStructureSliceCache,
  DEFAULT_STRUCTURE_BAND_PX,
  getVerticalBandLayout,
} from "../../../../engine/render/sprites/runtimeStructureSlicing";
import { registerSpriteMeta } from "../../../../engine/render/sprites/spriteMeta";
import { ownerTileForBandFromSE } from "../../../../engine/render/sprites/structureFootprintOwnership";

describe("runtimeStructureSlicing", () => {
  it("maps ownership tiles from SE anchor by walking west then north with duplicated SE corner", () => {
    const owners = Array.from({ length: 5 }, (_, i) => ownerTileForBandFromSE(2, 1, 3, 2, i));
    expect(owners).toEqual([
      { tx: 2, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 0, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 0 },
    ]);
  });

  it("uses provided SE anchorTx/anchorTy for ownership keys", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_explicit_anchor", {
      tileWidth: 3,
      tileHeight: 2,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "runtime_explicit_anchor",
      spriteId: "structures/buildings/test/runtime_explicit_anchor",
      seTx: 3,
      seTy: 4,
      footprintW: 3,
      footprintH: 2,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 320,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
    });
    const owners = pieces.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));
    expect(owners).toContainEqual({ tx: 3, ty: 4 });
    expect(owners).toContainEqual({ tx: 1, ty: 4 });
    expect(owners).toContainEqual({ tx: 3, ty: 3 });
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
      seTx: 1,
      seTy: 2,
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
      seTx: 1,
      seTy: 2,
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
      seTx: tx + w - 1,
      seTy: ty + h - 1,
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
      seTx: 1,
      seTy: 2,
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

  it("supports overriding core slice origin while preserving the full sprite span", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_custom_origin", {
      tileWidth: 2,
      tileHeight: 1,
      zHeight: 1,
    });
    const baseInput = {
      structureInstanceId: "runtime_custom_origin",
      spriteId: "structures/buildings/test/runtime_custom_origin",
      seTx: 9,
      seTy: 8,
      footprintW: 2,
      footprintH: 1,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 256,
      spriteHeight: 256,
      bandPx: 64,
      scale: 1,
      sliceOffsetX: 0,
    };
    const centered = buildRuntimeStructureBandPieces(baseInput);
    const shifted = buildRuntimeStructureBandPieces({
      ...baseInput,
      sliceOriginX: 20,
    });

    expect(centered.map((p) => p.srcRect.x)).toEqual([0, 32, 96, 160, 224]);
    expect(centered.map((p) => p.srcRect.w)).toEqual([32, 64, 64, 64, 32]);

    expect(shifted.map((p) => p.srcRect.x)).toEqual([0, 20, 84, 148, 212]);
    expect(shifted.map((p) => p.srcRect.w)).toEqual([20, 64, 64, 64, 44]);
    expect(shifted[1].dstRect.x).toBe(centered[1].dstRect.x - 12);

    const centeredLeft = centered[0].dstRect.x;
    const centeredRight = centered[centered.length - 1].dstRect.x + centered[centered.length - 1].dstRect.w;
    const shiftedLeft = shifted[0].dstRect.x;
    const shiftedRight = shifted[shifted.length - 1].dstRect.x + shifted[shifted.length - 1].dstRect.w;
    expect(shiftedLeft).toBe(centeredLeft);
    expect(shiftedRight).toBe(centeredRight);
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
      seTx: 1,
      seTy: 2,
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

  it("uses the same south-then-east ownership rule for flipped footprints", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_flip_owner", {
      tileWidth: 3,
      tileHeight: 2,
      zHeight: 1,
    });
    const common = {
      structureInstanceId: "flip_owner",
      spriteId: "structures/buildings/test/runtime_flip_owner",
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
    };
    const normal = buildRuntimeStructureBandPieces({
      ...common,
      seTx: 2,
      seTy: 1,
      flipped: false,
    });
    const flipped = buildRuntimeStructureBandPieces({
      ...common,
      seTx: 1,
      seTy: 2,
      flipped: true,
    });

    const normalOwners = normal.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));
    const flippedOwners = flipped.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));

    expect(normalOwners).toEqual([
      { tx: 0, ty: 1 },
      { tx: 0, ty: 1 },
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 2, ty: 0 },
      { tx: 2, ty: 0 },
    ]);
    expect(flippedOwners).toEqual([
      { tx: 0, ty: 2 },
      { tx: 0, ty: 2 },
      { tx: 1, ty: 2 },
      { tx: 1, ty: 2 },
      { tx: 1, ty: 1 },
      { tx: 1, ty: 0 },
      { tx: 1, ty: 0 },
    ]);
  });

  it("covers the full flipped south edge before walking north on east edge", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_flip_south_edge", {
      tileWidth: 3,
      tileHeight: 2,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "flip_south_edge",
      spriteId: "structures/buildings/test/runtime_flip_south_edge",
      seTx: 1,
      seTy: 2,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
      flipped: true,
    });
    const owners = pieces.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));
    const southEdgeOwners = owners.filter((o) => o.ty === 2);
    expect(southEdgeOwners).toContainEqual({ tx: 1, ty: 2 });
    expect(southEdgeOwners).toContainEqual({ tx: 0, ty: 2 });
  });

  it("does not re-orient already oriented footprint dimensions when flipped is true", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_flip_double_orient_guard", {
      tileWidth: 3,
      tileHeight: 2,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "flip_double_orient_guard",
      spriteId: "structures/buildings/test/runtime_flip_double_orient_guard",
      seTx: 1,
      seTy: 2,
      footprintW: 2,
      footprintH: 3,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
      flipped: true,
    });
    const owners = pieces.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));

    // 2x3 south-edge ownership from SE must include both (1,2) and (0,2),
    // with duplicated SE corner ownership.
    expect(owners).toContainEqual({ tx: 1, ty: 2 });
    expect(owners).toContainEqual({ tx: 0, ty: 2 });
    expect(owners.filter((o) => o.tx === 1 && o.ty === 2).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps flipped south-edge owner slices at or ahead of immediate south floor slices", () => {
    clearRuntimeStructureSliceCache();
    registerSpriteMeta("structures/buildings/test/runtime_flip_overlap_guard", {
      tileWidth: 3,
      tileHeight: 2,
      zHeight: 1,
    });
    const pieces = buildRuntimeStructureBandPieces({
      structureInstanceId: "flip_overlap_guard",
      spriteId: "structures/buildings/test/runtime_flip_overlap_guard",
      seTx: 1,
      seTy: 2,
      baseZ: 0,
      baseDx: 0,
      baseDy: 0,
      spriteWidth: 420,
      spriteHeight: 128,
      bandPx: 64,
      scale: 1,
      flipped: true,
    });

    const owners = pieces.map((p) => ({ tx: p.renderKey.within, ty: p.renderKey.slice - p.renderKey.within }));
    const southEdgeSlices = owners
      .filter((o) => o.ty === 2)
      .map((o) => o.tx + o.ty);

    const immediateSouthFloorSlices = [
      0 + 3, // floor tile south of SW footprint corner
      1 + 3, // floor tile south of SE footprint corner
    ];

    expect(Math.max(...southEdgeSlices)).toBeGreaterThanOrEqual(Math.min(...immediateSouthFloorSlices));
  });
});
