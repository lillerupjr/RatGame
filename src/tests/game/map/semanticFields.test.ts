import { describe, expect, it } from "vitest";
import {
  SEM_FIELD_WATER,
  TILE_ID_OCEAN,
  getSemanticFieldDefForTileId,
  tileIdToSemanticFieldId,
} from "../../../game/world/semanticFields";

describe("semanticFields", () => {
  it("maps OCEAN tile id to WATER field with liquid/non-walkable semantics", () => {
    expect(tileIdToSemanticFieldId(TILE_ID_OCEAN)).toBe(SEM_FIELD_WATER);
    expect(getSemanticFieldDefForTileId(TILE_ID_OCEAN)).toMatchObject({
      id: SEM_FIELD_WATER,
      isLiquid: true,
      isWalkable: false,
    });
  });
});
