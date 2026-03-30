import { describe, expect, test, vi, afterEach } from "vitest";
import { activateMapDef, activateMapDefAsync } from "../../../game/map/authoredMapActivation";
import { canvasGroundChunkCacheStore } from "../../../game/systems/presentation/presentationSubsystemStores";
import type { TableMapDef } from "../../../game/map/formats/table/tableMapTypes";

const TEST_MAP: TableMapDef = {
  id: "TEST_CACHE_RESET_MAP",
  w: 2,
  h: 2,
  centerOnZero: true,
  cells: [
    { x: 0, y: 0, type: "spawn", z: 0 },
    { x: 1, y: 0, type: "floor", z: 0 },
    { x: 0, y: 1, type: "floor", z: 0 },
    { x: 1, y: 1, type: "goal", z: 0 },
  ],
};

describe("authoredMapActivation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("activateMapDef clears the ground chunk cache before switching maps", () => {
    const clearSpy = vi.spyOn(canvasGroundChunkCacheStore, "clear");

    activateMapDef(TEST_MAP, 101);

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  test("activateMapDefAsync clears the ground chunk cache before switching maps", async () => {
    const clearSpy = vi.spyOn(canvasGroundChunkCacheStore, "clear");

    await activateMapDefAsync(TEST_MAP, 202);

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
