import { describe, expect, test } from "vitest";
import {
  assertPaletteSnapshotWorldStateScope,
  PALETTE_LAB_ALLOWED_CAPABILITIES,
  PALETTE_LAB_FORBIDDEN_CAPABILITIES,
  PALETTE_SNAPSHOT_PURPOSE,
} from "../../../game/paletteLab/scope";

describe("palette snapshot scope contract", () => {
  test("purpose is locked to visual scene reproduction", () => {
    expect(PALETTE_SNAPSHOT_PURPOSE).toBe("visual-scene-reproduction");
  });

  test("allowed capabilities are capture/store/browse/adjust only", () => {
    expect(PALETTE_LAB_ALLOWED_CAPABILITIES).toEqual([
      "snapshot.capture",
      "snapshot.store",
      "snapshot.browse",
      "comparison.adjust",
    ]);
  });

  test("forbidden capabilities remain outside palette snapshot scope", () => {
    expect(PALETTE_LAB_FORBIDDEN_CAPABILITIES).toEqual([
      "gameplay.saveLoad",
      "run.persistence",
      "progression.persistence",
      "inventory.persistence",
    ]);
  });

  test("minimal visual-only world state is accepted", () => {
    expect(() =>
      assertPaletteSnapshotWorldStateScope({
        player: { x: 10, y: 12, facing: "south" },
        enemies: [{ id: "enemy_a", x: 11, y: 12 }],
        lighting: { darknessAlpha: 0.45 },
      }),
    ).not.toThrow();
  });

  test("payloads with persistence fields are rejected", () => {
    expect(() =>
      assertPaletteSnapshotWorldStateScope({
        player: { x: 10, y: 12 },
        inventory: { gold: 100 },
        progression: { clearedFloors: 2 },
      }),
    ).toThrow(/forbidden persistence fields/i);
  });

  test("payloads with unsupported non-visual fields are rejected", () => {
    expect(() =>
      assertPaletteSnapshotWorldStateScope({
        player: { x: 10, y: 12 },
        enemies: [],
        lighting: { darknessAlpha: 0.5 },
        worldCheckpoint: { floor: 2 },
      }),
    ).toThrow(/unsupported non-visual fields/i);
  });
});
