import { describe, expect, it } from "vitest";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import { BUILDING_PACKS, BUILDING_SKINS } from "../../../../game/content/buildings";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";
import { CONTAINER_SKINS } from "../../../../game/content/containers";
import { seAnchorFromTopLeft } from "../../../../engine/render/sprites/structureFootprintOwnership";

describe("structure legacy transition", () => {
  it("uses monolithic flat container assets during runtime-slicing", () => {
    const def = getAuthoredMapDefByMapId("docks");
    expect(def).toBeTruthy();

    const compiled = compileKenneyMapFromTable(def!);

    const structureOverlays = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE"
        && o.spriteId.includes("structures/containers/")
    );
    expect(structureOverlays.length).toBeGreaterThan(0);
    expect(structureOverlays.some((o) => o.spriteId === "structures/containers/container_base")).toBe(true);

    const wallPieces = Array.from(compiled.occludersByLayer.values())
      .flat()
      .filter((p) => p.kind === "WALL" && p.spriteId.includes("structures/containers/"));
    expect(wallPieces.length).toBe(0);
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

  it("auto-rotates flippable buildings when only flipped orientation fits the field", () => {
    const mapDef: TableMapDef = {
      id: "auto_rotate_field_fit",
      w: 4,
      h: 10,
      buildingPackId: "avenue_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 0, y: 0, z: 0, type: "building", w: 2, h: 8 }],
    };

    const compiled = compileKenneyMapFromTable(mapDef);
    const structureOverlays = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/"),
    );
    expect(structureOverlays.length).toBeGreaterThan(0);
    expect(structureOverlays.some((o) => !!o.flipX)).toBe(true);
  });

  it("bakes collision strictly from logical building footprint tiles", () => {
    const mapDef: TableMapDef = {
      id: "collision_building_footprint",
      w: 8,
      h: 8,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 3, z: 0, type: "building", skinId: "building1", w: 3, h: 2, collision: "BLOCK" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    expect(compiled.blockedTiles.has("2,3")).toBe(true);
    expect(compiled.blockedTiles.has("3,3")).toBe(true);
    expect(compiled.blockedTiles.has("4,3")).toBe(true);
    expect(compiled.blockedTiles.has("2,4")).toBe(true);
    expect(compiled.blockedTiles.has("3,4")).toBe(true);
    expect(compiled.blockedTiles.has("4,4")).toBe(true);
    expect(compiled.blockedTiles.has("5,4")).toBe(false);
  });

  it("flips non-square footprints and collision from 3x2 to 2x3", () => {
    const mapDef: TableMapDef = {
      id: "collision_building_flip",
      w: 8,
      h: 8,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", skinId: "building1", w: 3, h: 2, flipped: true, collision: "BLOCK" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    // footprint should become 2x3 anchored at same tile origin
    expect(compiled.blockedTiles.has("1,1")).toBe(true);
    expect(compiled.blockedTiles.has("2,1")).toBe(true);
    expect(compiled.blockedTiles.has("1,2")).toBe(true);
    expect(compiled.blockedTiles.has("2,2")).toBe(true);
    expect(compiled.blockedTiles.has("1,3")).toBe(true);
    expect(compiled.blockedTiles.has("2,3")).toBe(true);
    expect(compiled.blockedTiles.has("3,1")).toBe(false);
  });

  it("applies stackLevel using heightUnits for container z placement", () => {
    const container = CONTAINER_SKINS.container1;
    const mapDef: TableMapDef = {
      id: "container_stack_level",
      w: 6,
      h: 6,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{
        x: 1,
        y: 1,
        z: 0,
        type: "container",
        skinId: "container1",
        w: container.w,
        h: container.h,
        stackLevel: 1,
        stackChance: 0,
      }],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    const structure = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/containers/"));
    expect(structure).toBeTruthy();
    expect(structure!.z).toBeGreaterThanOrEqual(container.heightUnits);
  });

  it("auto-flips container skin when only flipped orientation matches stamp dimensions", () => {
    const mapDef: TableMapDef = {
      id: "container_auto_flip_fit",
      w: 8,
      h: 8,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "container", w: 2, h: 3, pool: ["containers"] }],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    const structure = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/containers/"));
    expect(structure).toBeTruthy();
    expect(structure!.w).toBe(2);
    expect(structure!.h).toBe(3);
    expect(!!structure!.flipX).toBe(true);
  });

  it("emits SE anchor tiles for oriented structure overlays", () => {
    const mapDef: TableMapDef = {
      id: "structure_overlay_se_anchor",
      w: 8,
      h: 8,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [
        { x: 2, y: 1, z: 0, type: "building", skinId: "building1", w: 3, h: 2 },
        { x: 1, y: 4, z: 0, type: "building", skinId: "building1", w: 3, h: 2, flipped: true },
      ],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    const structures = compiled.overlays.filter((o) => o.layerRole === "STRUCTURE");
    expect(structures.length).toBeGreaterThanOrEqual(2);

    for (const s of structures) {
      const seAnchor = seAnchorFromTopLeft(s.tx, s.ty, s.w, s.h);
      expect(s.anchorTx).toBe(seAnchor.anchorTx);
      expect(s.anchorTy).toBe(seAnchor.anchorTy);
    }
  });
});
