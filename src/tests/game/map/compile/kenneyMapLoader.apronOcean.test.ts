import { describe, expect, it } from "vitest";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";

describe("kenneyMapLoader ocean apron emission", () => {
  it("emits FLOOR_APRON pieces on floor-to-ocean edges using apron slot directional suffixes", () => {
    const mapDef: TableMapDef = {
      id: "apron_ocean_suffix_map",
      w: 2,
      h: 2,
      mapSkinId: "docks",
      cells: [
        { x: 0, y: 0, z: 0, type: "floor" },
        { x: 1, y: 0, z: -1, type: "ocean" },
        { x: 0, y: 1, z: -1, type: "ocean" },
        { x: 1, y: 1, z: -1, type: "ocean" },
      ],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 1, mapId: mapDef.id });
    const aprons = Array.from(compiled.facePiecesByLayer.values())
      .flat()
      .filter((p) => p.kind === "FLOOR_APRON");

    const east = aprons.find((p) => p.tx === 0 && p.ty === 0 && p.edgeDir === "E");
    const south = aprons.find((p) => p.tx === 0 && p.ty === 0 && p.edgeDir === "S");

    expect(east?.spriteId).toBe("tiles/walls/sidewalk_apron_e");
    expect(south?.spriteId).toBe("tiles/walls/sidewalk_apron_s");
  });

  it("does not emit aprons between two neighboring ocean tiles", () => {
    const mapDef: TableMapDef = {
      id: "no_apron_ocean_to_ocean",
      w: 2,
      h: 1,
      mapSkinId: "docks",
      cells: [
        { x: 0, y: 0, z: -1, type: "ocean" },
        { x: 1, y: 0, z: -2, type: "ocean" },
      ],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 2, mapId: mapDef.id });
    const aprons = Array.from(compiled.facePiecesByLayer.values())
      .flat()
      .filter((p) => p.kind === "FLOOR_APRON");

    const oceanSeamApron = aprons.find((p) => p.tx === 0 && p.ty === 0 && p.edgeDir === "E");
    expect(oceanSeamApron).toBeUndefined();
  });
});
