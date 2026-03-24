import { beforeAll, describe, expect, it } from "vitest";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import { BUILDING_PACKS, BUILDING_SKINS } from "../../../../game/content/buildings";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";
import { CONTAINER_SKINS } from "../../../../game/content/containers";
import { seAnchorFromTopLeft } from "../../../../engine/render/sprites/structureFootprintOwnership";
import { RUNTIME_FLOOR_VARIANT_COUNTS } from "../../../../game/content/runtimeFloorConfig";
import {
  computeMonolithicBuildingSemanticsForSkinIds,
  getRequiredMonolithicBuildingPlacementGeometry,
} from "../../../../game/structures/monolithicBuildingSemanticPrepass";
import { renderHeightUnitsToSweepTileHeight } from "../../../../game/map/tileHeightUnits";

describe("structure legacy transition", () => {
  beforeAll(async () => {
    const result = await computeMonolithicBuildingSemanticsForSkinIds(Object.keys(BUILDING_SKINS), {
      timeoutMs: 15000,
      pollMs: 8,
    });
    expect(result.missingSkinIds).toEqual([]);
  });

  it("limits downtown building pack to directional skins 1..3", () => {
    expect(BUILDING_PACKS.downtown_buildings).toEqual(["downtown_1", "downtown_2", "downtown_3"]);
  });

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

  it("uses downtown building pack assets for downtown semantic building areas", () => {
    const downtownPackIds = BUILDING_PACKS.downtown_buildings ?? [];
    expect(downtownPackIds.length).toBeGreaterThan(0);
    const seedId = downtownPackIds.find((id) => !!BUILDING_SKINS[id]);
    expect(seedId).toBeTruthy();
    const seedGeometry = getRequiredMonolithicBuildingPlacementGeometry(seedId!, "test:downtown-pack-smoke");

    const mapDef: TableMapDef = {
      id: "downtown_pack_smoke",
      w: Math.max(8, seedGeometry.w + 2),
      h: Math.max(8, seedGeometry.h + 2),
      buildingPackId: "downtown_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: seedGeometry.w, h: seedGeometry.h }],
    };

    const compiled = compileKenneyMapFromTable(mapDef);
    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/downtown/"))).toBe(true);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/china_town/"))).toBe(false);
  });

  it("keeps downtown_2 footprint parity and removes authored lift dependency", () => {
    const skin = BUILDING_SKINS.downtown_2;
    expect(skin).toBeTruthy();
    expect(() => (skin as any).w).toThrow();
    expect(() => (skin as any).h).toThrow();
    expect(() => (skin as any).heightUnits).toThrow();
    const semantic = getRequiredMonolithicBuildingPlacementGeometry("downtown_2", "test:downtown_2");
    expect(semantic.w).toBe(4);
    expect(semantic.h).toBe(4);
    expect(semantic.heightUnits).toBe(32);
    expect(semantic.tileHeightUnits).toBe(13);
    expect(skin.anchorLiftUnits).toBeUndefined();

    const mapDef: TableMapDef = {
      id: "downtown_2_computed_metadata_parity",
      w: 10,
      h: 10,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", skinId: "downtown_2", w: 4, h: 4 }],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 919, mapId: mapDef.id });
    const roof = compiled.overlays.find(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.startsWith("structures/buildings/downtown/2"),
    );
    expect(roof).toBeTruthy();
    expect(roof?.w).toBe(4);
    expect(roof?.h).toBe(4);
    expect(roof?.drawDyOffset).toBe(0);
  });

  it("uses directional downtown roof sprite IDs when building dir is set", () => {
    const mapDef: TableMapDef = {
      id: "downtown_directional_sprite_id",
      w: 12,
      h: 12,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", skinId: "downtown_1", w: 5, h: 7, dir: "N" }],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 777, mapId: mapDef.id });
    const roof = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/1"));
    expect(roof).toBeTruthy();
    expect(roof?.spriteId).toBe("structures/buildings/downtown/1/n");
  });

  it("rotates footprint axis for cardinal building dir", () => {
    const mapDef: TableMapDef = {
      id: "downtown_directional_footprint_axis",
      w: 16,
      h: 16,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", skinId: "downtown_1", w: 5, h: 7, dir: "E", collision: "BLOCK" }],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 778, mapId: mapDef.id });
    const roof = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/1"));
    expect(roof).toBeTruthy();
    expect(roof?.w).toBe(7);
    expect(roof?.h).toBe(5);
    expect(roof?.spriteId).toBe("structures/buildings/downtown/1/e");
    expect(compiled.blockedTiles.has("7,5")).toBe(true);
    expect(compiled.blockedTiles.has("8,5")).toBe(false);
  });

  it("propagates building dir through random-pack decomposition", () => {
    const mapDef: TableMapDef = {
      id: "downtown_directional_random_pack",
      w: 20,
      h: 20,
      buildingPackId: "downtown_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 12, h: 12, dir: "W" }],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 779, mapId: mapDef.id });
    const roofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.startsWith("structures/buildings/downtown/"),
    );
    expect(roofs.length).toBeGreaterThan(0);
    expect(roofs.every((o) => o.spriteId.endsWith("/w"))).toBe(true);
  });

  it("keeps non-directional building sprite IDs when dir is omitted", () => {
    const mapDef: TableMapDef = {
      id: "downtown_non_directional_regression",
      w: 12,
      h: 12,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", skinId: "downtown_1", w: 5, h: 7 }],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 780, mapId: mapDef.id });
    const roof = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.startsWith("structures/buildings/downtown/1"));
    expect(roof).toBeTruthy();
    expect(roof?.spriteId).toBe("structures/buildings/downtown/1");
  });

  it("perimeter_outward layout only anchors buildings on the boundary ring", () => {
    const mapDef: TableMapDef = {
      id: "downtown_perimeter_boundary_only",
      w: 20,
      h: 20,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", skinId: "downtown_2", w: 12, h: 12, layout: "perimeter_outward" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 810, mapId: mapDef.id });
    const structures = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/2/"),
    );
    expect(structures.length).toBeGreaterThan(0);
    const minX = 1;
    const minY = 1;
    const maxX = minX + 12 - 1;
    const maxY = minY + 12 - 1;
    expect(structures.every((s) =>
      s.tx === minX
      || s.ty === minY
      || (s.tx + s.w - 1) === maxX
      || (s.ty + s.h - 1) === maxY,
    )).toBe(true);
    expect(structures.every((s) => /\/[nesw]$/.test(s.spriteId))).toBe(true);
  });

  it("perimeter_outward corner picks use outward-facing adjacent side dirs", () => {
    const mapDef: TableMapDef = {
      id: "downtown_perimeter_corner_priority",
      w: 20,
      h: 20,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", skinId: "downtown_2", w: 12, h: 12, layout: "perimeter_outward" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 811, mapId: mapDef.id });
    const structures = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/2/"),
    );
    const coverAt = (x: number, y: number) =>
      structures.find((s) => x >= s.tx && x < (s.tx + s.w) && y >= s.ty && y < (s.ty + s.h));
    const minX = 1;
    const minY = 1;
    const maxX = minX + 12 - 1;
    const maxY = minY + 12 - 1;

    expect(coverAt(maxX, maxY)).toBeTruthy();
    expect(
      coverAt(maxX, maxY)?.spriteId.endsWith("/s")
      || coverAt(maxX, maxY)?.spriteId.endsWith("/e"),
    ).toBe(true); // SE -> S|E

    expect(coverAt(maxX, minY)).toBeTruthy();
    expect(
      coverAt(maxX, minY)?.spriteId.endsWith("/e")
      || coverAt(maxX, minY)?.spriteId.endsWith("/n"),
    ).toBe(true); // NE -> E|N

    expect(coverAt(minX, minY)).toBeTruthy();
    expect(
      coverAt(minX, minY)?.spriteId.endsWith("/n")
      || coverAt(minX, minY)?.spriteId.endsWith("/w"),
    ).toBe(true); // NW -> N|W

    expect(coverAt(minX, maxY)).toBeTruthy();
    expect(
      coverAt(minX, maxY)?.spriteId.endsWith("/s")
      || coverAt(minX, maxY)?.spriteId.endsWith("/w"),
    ).toBe(true); // SW -> S|W
  });

  it("perimeter_outward corner pass keeps all corners outward-facing", () => {
    const mapDef: TableMapDef = {
      id: "downtown_perimeter_corner_first_pass",
      w: 26,
      h: 26,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", skinId: "downtown_1", w: 16, h: 16, layout: "perimeter_outward" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 901, mapId: mapDef.id });
    const structures = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/1/"),
    );
    const coverAt = (x: number, y: number) =>
      structures.find((s) => x >= s.tx && x < (s.tx + s.w) && y >= s.ty && y < (s.ty + s.h));

    const minX = 2;
    const minY = 2;
    const maxX = minX + 16 - 1;
    const maxY = minY + 16 - 1;

    expect(
      coverAt(maxX, maxY)?.spriteId.endsWith("/s")
      || coverAt(maxX, maxY)?.spriteId.endsWith("/e"),
    ).toBe(true); // SE -> S|E
    expect(
      coverAt(minX, maxY)?.spriteId.endsWith("/s")
      || coverAt(minX, maxY)?.spriteId.endsWith("/w"),
    ).toBe(true); // SW -> S|W
    expect(
      coverAt(maxX, minY)?.spriteId.endsWith("/e")
      || coverAt(maxX, minY)?.spriteId.endsWith("/n"),
    ).toBe(true); // NE -> E|N
    expect(
      coverAt(minX, minY)?.spriteId.endsWith("/n")
      || coverAt(minX, minY)?.spriteId.endsWith("/w"),
    ).toBe(true); // NW -> N|W
  });

  it("perimeter_outward placement is deterministic for the same seed", () => {
    const mapDef: TableMapDef = {
      id: "downtown_perimeter_deterministic",
      w: 24,
      h: 24,
      buildingPackId: "downtown_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", w: 14, h: 14, layout: "perimeter_outward" }],
    };
    const a = compileKenneyMapFromTable(mapDef, { runSeed: 812, mapId: mapDef.id });
    const b = compileKenneyMapFromTable(mapDef, { runSeed: 812, mapId: mapDef.id });
    const normalize = (compiled: ReturnType<typeof compileKenneyMapFromTable>) =>
      compiled.overlays
        .filter((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/"))
        .map((o) => ({ tx: o.tx, ty: o.ty, w: o.w, h: o.h, spriteId: o.spriteId }));
    expect(normalize(a)).toEqual(normalize(b));
  });

  it("perimeter_outward uses dir as side-priority seed", () => {
    const makeMap = (dir: "E" | "W"): TableMapDef => ({
      id: "downtown_perimeter_dir_priority",
      w: 28,
      h: 28,
      buildingPackId: "downtown_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 3, y: 2, z: 0, type: "building", w: 13, h: 15, layout: "perimeter_outward", dir }],
    });

    const e = compileKenneyMapFromTable(makeMap("E"), { runSeed: 813, mapId: "perimeter_dir_priority" });
    const w = compileKenneyMapFromTable(makeMap("W"), { runSeed: 813, mapId: "perimeter_dir_priority" });

    const normalize = (compiled: ReturnType<typeof compileKenneyMapFromTable>) =>
      compiled.overlays
        .filter((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/downtown/"))
        .map((o) => ({ tx: o.tx, ty: o.ty, w: o.w, h: o.h, spriteId: o.spriteId }))
        .sort((a, b) =>
          a.tx - b.tx
          || a.ty - b.ty
          || a.w - b.w
          || a.h - b.h
          || a.spriteId.localeCompare(b.spriteId),
        );

    expect(normalize(e)).not.toEqual(normalize(w));
  });

  it("uses china town building pack assets for china town semantic building areas", () => {
    const chinaPackIds = BUILDING_PACKS["china_town_buildings"] ?? [];
    expect(chinaPackIds.length).toBeGreaterThan(0);
    const seedId = chinaPackIds.find((id) => !!BUILDING_SKINS[id]);
    expect(seedId).toBeTruthy();
    const seedGeometry = getRequiredMonolithicBuildingPlacementGeometry(seedId!, "test:china-pack-smoke");

    const mapDef: TableMapDef = {
      id: "china_pack_smoke",
      w: Math.max(4, seedGeometry.w + 1),
      h: Math.max(4, seedGeometry.h + 1),
      buildingPackId: "china_town_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 0, y: 0, z: 0, type: "building", w: seedGeometry.w, h: seedGeometry.h }],
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
    const containerW = container.w ?? 3;
    const containerH = container.h ?? 2;
    const containerHeightUnits = container.heightUnits ?? 8;
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
        w: containerW,
        h: containerH,
        stackLevel: 1,
        stackChance: 0,
      }],
    };
    const compiled = compileKenneyMapFromTable(mapDef);
    const structure = compiled.overlays.find((o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/containers/"));
    expect(structure).toBeTruthy();
    expect(structure!.z).toBeGreaterThanOrEqual(containerHeightUnits);
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

  it("renders sidewalk semantics through runtime variant+rotation metadata deterministically", () => {
    const mapDef: TableMapDef = {
      id: "runtime_sidewalk_semantic",
      w: 6,
      h: 6,
      cells: [],
      stamps: [{ x: 1, y: 2, z: 0, type: "sidewalk", w: 2, h: 2 }],
    };

    const a = compileKenneyMapFromTable(mapDef, { runSeed: 1234, mapId: mapDef.id });
    const b = compileKenneyMapFromTable(mapDef, { runSeed: 1234, mapId: mapDef.id });
    const c = compileKenneyMapFromTable(mapDef, { runSeed: 9876, mapId: mapDef.id });

    const sampleCoords: Array<[number, number]> = [
      [1, 2],
      [2, 2],
      [1, 3],
      [2, 3],
    ];
    const sampleAt = (compiled: ReturnType<typeof compileKenneyMapFromTable>) =>
      sampleCoords.map(([tx, ty]) => compiled.surfacesAtXY(tx, ty).find((s) => s.id.startsWith("stamp_sidewalk_") || s.id.startsWith("stamp_asphalt_") || s.id.startsWith("stamp_park_"))?.runtimeTop ?? null);

    const sampleA = sampleAt(a);
    const sampleB = sampleAt(b);
    const sampleC = sampleAt(c);
    const sa = sampleA[0];

    expect(sa?.kind).toBe("SQUARE_128_RUNTIME");
    expect(sa?.family).toBe("sidewalk");
    expect(sa?.variantIndex).toBeGreaterThanOrEqual(1);
    expect(sa?.variantIndex).toBeLessThanOrEqual(RUNTIME_FLOOR_VARIANT_COUNTS.sidewalk);
    expect(sa?.rotationQuarterTurns).toBeGreaterThanOrEqual(0);
    expect(sa?.rotationQuarterTurns).toBeLessThanOrEqual(3);

    expect(sampleA).toEqual(sampleB);
    // Different seeds should produce different results only if there are multiple variants
    if (RUNTIME_FLOOR_VARIANT_COUNTS.sidewalk > 1) {
      expect(sampleA.some((top, i) => JSON.stringify(top) !== JSON.stringify(sampleC[i]))).toBe(true);
    }
  });

  it("routes road/park semantics to asphalt/park runtime square floor families", () => {
    const mapDef: TableMapDef = {
      id: "runtime_floor_families",
      w: 6,
      h: 6,
      cells: [],
      stamps: [
        { x: 0, y: 0, z: 0, type: "road", w: 1, h: 1 },
        { x: 1, y: 0, z: 0, type: "park", w: 1, h: 1 },
      ],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 555, mapId: mapDef.id });
    const roadTop = compiled.surfacesAtXY(0, 0).find((s) => s.id.startsWith("stamp_asphalt_"))?.runtimeTop;
    const parkTop = compiled.surfacesAtXY(1, 0).find((s) => s.id.startsWith("stamp_park_"))?.runtimeTop;

    expect(roadTop?.kind).toBe("SQUARE_128_RUNTIME");
    expect(roadTop?.family).toBe("asphalt");
    expect(roadTop?.spriteId).toBe("tiles/floor/asphalt/1");

    expect(parkTop?.kind).toBe("SQUARE_128_RUNTIME");
    expect(parkTop?.family).toBe("park");
    expect(parkTop?.variantIndex).toBeGreaterThanOrEqual(1);
    expect(parkTop?.variantIndex).toBeLessThanOrEqual(RUNTIME_FLOOR_VARIANT_COUNTS.park);
  });

  it("emits compiled lightDefs from map lights in world-space anchors", () => {
    const mapDef: TableMapDef = {
      id: "compiled_light_defs",
      w: 4,
      h: 4,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      lights: [{ x: 2, y: 1, heightUnits: 3, radiusPx: 140, intensity: 0.8 }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 101, mapId: mapDef.id });
    expect(compiled.lightDefs.length).toBe(1);
    expect(compiled.lightDefs[0]).toMatchObject({
      id: "authored_light_compiled_light_defs_0",
      worldX: (2 + 0.5) * 64,
      worldY: (1 + 0.5) * 64,
      zBase: 3,
      zLogical: 3,
      supportHeightUnits: 3,
      heightUnits: 3,
      radiusPx: 140,
      intensity: 0.8,
      colorMode: "standard",
      strength: "medium",
      shape: "RADIAL",
    });
  });

  it("builds STREET_LAMP lightDefs from semantic street lamp variants", () => {
    const mapDef: TableMapDef = {
      id: "street_lamp_semantic_compile",
      w: 4,
      h: 4,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      lights: [{ x: 1, y: 1, radiusPx: 100, intensity: 0.9, semanticType: "street_lamp_e" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 22, mapId: mapDef.id });
    expect(compiled.lightDefs.length).toBe(1);
    const light = compiled.lightDefs[0];
    expect(light.id).toBe("authored_light_street_lamp_semantic_compile_0");
    expect(light.zBase).toBe(0);
    expect(light.zLogical).toBe(0);
    expect(light.shape).toBe("STREET_LAMP");
    expect(light.pool?.radiusPx).toBe(120);
    expect(light.pool?.yScale).toBe(0.65);
    expect(light.cone?.dirRad).toBe(Math.PI * 0.5); // Light direction is fixed, doesn't depend on sprite direction
    expect(light.cone?.angleRad).toBe(0.9);
    expect(light.cone?.lengthPx).toBe(260);
    expect(light.color).toBe("#FFFB74");
    expect(light.colorMode).toBe("standard");
    expect(light.strength).toBe("medium");
  });

  it("builds neon semantic presets as colored RADIAL lightDefs", () => {
    const mapDef: TableMapDef = {
      id: "neon_semantic_compile",
      w: 4,
      h: 4,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      lights: [{ x: 1, y: 1, radiusPx: 80, intensity: 0.4, semanticType: "neon_sign_pink" }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 33, mapId: mapDef.id });
    expect(compiled.lightDefs.length).toBe(1);
    const light = compiled.lightDefs[0];
    expect(light.id).toBe("authored_light_neon_semantic_compile_0");
    expect(light.zBase).toBe(0);
    expect(light.zLogical).toBe(0);
    expect(light.shape).toBe("RADIAL");
    expect(light.color).toBe("#FF4FD8");
    expect(light.tintStrength).toBe(0.70);
    expect(light.radiusPx).toBe(220);
    expect(light.intensity).toBe(0.75);
    expect(light.colorMode).toBe("standard");
    expect(light.strength).toBe("medium");
    expect(light.flicker).toEqual({ kind: "NOISE", speed: 9, amount: 0.25 });
  });

  it("builds tileHeightGrid from compiled structure data instead of sprite scans", () => {
    const avenueGeometry = getRequiredMonolithicBuildingPlacementGeometry("avenue_1", "test:height-grid");
    const mapDef: TableMapDef = {
      id: "compiled_height_grid_structure_authority",
      w: 8,
      h: 8,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [
        { x: 2, y: 2, z: 0, type: "building", skinId: "building1", w: avenueGeometry.w, h: avenueGeometry.h },
        { x: 5, y: 5, z: 0, type: "prop", propId: "street_lamp_n", w: 1, h: 1 },
      ],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 404, mapId: mapDef.id });
    const grid = compiled.tileHeightGrid;
    const at = (tx: number, ty: number) => grid.heights[(ty - grid.originTy) * grid.width + (tx - grid.originTx)];

    expect(at(2, 2)).toBe(avenueGeometry.tileHeightUnits);
    expect(at(2 + avenueGeometry.w - 1, 2 + avenueGeometry.h - 1)).toBe(avenueGeometry.tileHeightUnits);
    expect(at(5, 5)).toBe(renderHeightUnitsToSweepTileHeight(12));
    expect(grid.version).toMatch(/^h[0-9a-f]+$/);
  });

  it("registers avenue2 with the batch processed building pack", () => {
    const def = getAuthoredMapDefByMapId("avenue2");
    expect(def).toBeTruthy();
    expect(def?.buildingPackId).toBe("batch_processed_buildings");
    expect(BUILDING_PACKS.batch_processed_buildings?.length).toBeGreaterThan(0);
    expect(BUILDING_SKINS.bp_0?.roof).toBe("structures/buildings/batch_processed/0");
  });

  it("street lamp props emit their own lightDef and do not block movement", () => {
    const mapDef: TableMapDef = {
      id: "street_lamp_prop_semantic",
      w: 6,
      h: 6,
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 3, y: 2, z: 0, type: "prop", propId: "street_lamp_e", w: 1, h: 1 }],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 77, mapId: mapDef.id });
    const lampLight = compiled.lightDefs.find((l) => l.shape === "STREET_LAMP");
    expect(lampLight).toBeTruthy();
    expect(lampLight?.id).toBe("prop_light_street_lamp_e_3_2_0");
    expect(lampLight?.zBase).toBe(0);
    expect(lampLight?.zLogical).toBe(0);
    expect(lampLight?.colorMode).toBe("standard");
    expect(lampLight?.strength).toBe("medium");
    expect(compiled.blockedTiles.has("3,2")).toBe(false);
  });
});
