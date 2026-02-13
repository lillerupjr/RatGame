import { describe, expect, it } from "vitest";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import { BUILDING_PACKS, BUILDING_SKINS } from "../../../../game/content/buildings";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";

describe("structure legacy transition", () => {
  it("keeps legacy sliced container assets working during runtime-slicing migration", () => {
    const def = getAuthoredMapDefByMapId("docks");
    expect(def).toBeTruthy();

    const compiled = compileKenneyMapFromTable(def!);

    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE"
        && o.spriteId.includes("structures/containers/")
        && o.spriteId.endsWith("/top"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);

    const wallPieces = Array.from(compiled.occludersByLayer.values())
      .flat()
      .filter((p) => p.kind === "WALL" && p.spriteId.includes("structures/containers/"));
    expect(wallPieces.length).toBeGreaterThan(0);

    const legacyWallSlices = wallPieces.filter((p) => /\/(s|e)_\d+$/.test(p.spriteId));
    expect(legacyWallSlices.length).toBeGreaterThan(0);
  });

  it("uses avenue building pack assets for avenue semantic building areas", () => {
    const def = getAuthoredMapDefByMapId("avenue");
    expect(def).toBeTruthy();
    expect(def?.buildingPackId).toBe("avenue_buildings");

    const compiled = compileKenneyMapFromTable(def!);
    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/avenue/"))).toBe(true);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/china_town/"))).toBe(false);
  });

  it("uses china town building pack assets for china town semantic building areas", () => {
    const chinaPackIds = BUILDING_PACKS["china_town_buildings"] ?? [];
    expect(chinaPackIds.length).toBeGreaterThan(0);
    const seedSkin = BUILDING_SKINS[chinaPackIds[0]];
    expect(seedSkin).toBeTruthy();

    const mapDef: TableMapDef = {
      id: "china_pack_smoke",
      w: Math.max(4, seedSkin.w + 1),
      h: Math.max(4, seedSkin.h + 1),
      buildingPackId: "china_town_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 0, y: 0, z: 0, type: "building", w: seedSkin.w, h: seedSkin.h }],
    };

    const compiled = compileKenneyMapFromTable(mapDef);
    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/china_town/"))).toBe(true);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/avenue/"))).toBe(false);
  });
});
