import { describe, expect, it } from "vitest";

import { loadTableMapDefFromJson } from "../../../../../game/map/formats/json/jsonMapLoader";
import jsonMinimalMap from "../../../../../game/map/authored/maps/jsonMaps/minimal.json";

describe("jsonMapLoader", () => {
  it("converts a minimal JSON map into an equivalent TableMapDef", () => {
    const mapDef = loadTableMapDefFromJson(jsonMinimalMap, "authored/maps/jsonMaps/minimal.json");

    expect(mapDef).toEqual({
      id: "JSON_MINIMAL",
      w: 3,
      h: 3,
      cells: [
        { x: 1, y: 1, t: "P0" },
        { x: 0, y: 1, t: "F0" },
        { x: 2, y: 1, t: "F0" },
        { x: 1, y: 0, t: "F0" },
        { x: 1, y: 2, t: "F0" },
      ],
    });
  });
});
