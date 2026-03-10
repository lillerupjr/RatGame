import { describe, expect, it } from "vitest";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import { BUILDING_PACKS, BUILDING_SKINS } from "../../../../game/content/buildings";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";
import { CONTAINER_SKINS } from "../../../../game/content/containers";
import { seAnchorFromTopLeft } from "../../../../engine/render/sprites/structureFootprintOwnership";
import { RUNTIME_FLOOR_VARIANT_COUNTS } from "../../../../game/content/runtimeFloorConfig";

describe("structure legacy transition", () => {
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
    const seedSkin = BUILDING_SKINS[seedId!];

    const mapDef: TableMapDef = {
      id: "downtown_pack_smoke",
      w: Math.max(8, seedSkin.w + 2),
      h: Math.max(8, seedSkin.h + 2),
      buildingPackId: "downtown_buildings",
      cells: [{ x: 0, y: 0, z: 0, type: "floor" }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: seedSkin.w, h: seedSkin.h }],
    };

    const compiled = compileKenneyMapFromTable(mapDef);
    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE" && o.spriteId.includes("structures/buildings/"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/downtown/"))).toBe(true);
    expect(structureRoofs.some((o) => o.spriteId.includes("structures/buildings/china_town/"))).toBe(false);
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

  it("perimeter_outward uses S→E→N→W corner ownership with fallback", () => {
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
    expect(coverAt(maxX, maxY)?.spriteId.endsWith("/s")).toBe(true); // SE -> S

    expect(coverAt(maxX, minY)).toBeTruthy();
    expect(coverAt(maxX, minY)?.spriteId.endsWith("/e")).toBe(true); // NE -> E

    expect(coverAt(minX, minY)).toBeTruthy();
    expect(coverAt(minX, minY)?.spriteId.endsWith("/n")).toBe(true); // NW -> N

    expect(coverAt(minX, maxY)).toBeTruthy();
    expect(coverAt(minX, maxY)?.spriteId.endsWith("/s")).toBe(true); // SW -> S
  });

  it("perimeter_outward resolves corners before side fill", () => {
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

    expect(coverAt(maxX, maxY)?.spriteId.endsWith("/s")).toBe(true); // SE corner set by S pass
    expect(coverAt(minX, maxY)?.spriteId.endsWith("/s")).toBe(true); // SW corner set by S pass
    expect(coverAt(maxX, minY)?.spriteId.endsWith("/e")).toBe(true); // NE corner set by E pass
    expect(coverAt(minX, minY)?.spriteId.endsWith("/n")).toBe(true); // NW corner set by N pass
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
      worldX: (2 + 0.5) * 64,
      worldY: (1 + 0.5) * 64,
      heightUnits: 3,
      radiusPx: 140,
      intensity: 0.8,
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
    expect(light.shape).toBe("STREET_LAMP");
    expect(light.pool?.radiusPx).toBe(120);
    expect(light.pool?.yScale).toBe(0.65);
    expect(light.cone?.dirRad).toBe(Math.PI * 0.5); // Light direction is fixed, doesn't depend on sprite direction
    expect(light.cone?.angleRad).toBe(0.9);
    expect(light.cone?.lengthPx).toBe(260);
    expect(light.color).toBe("#FFFB74");
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
    expect(light.shape).toBe("RADIAL");
    expect(light.color).toBe("#FF4FD8");
    expect(light.tintStrength).toBe(0.70);
    expect(light.radiusPx).toBe(220);
    expect(light.intensity).toBe(0.75);
    expect(light.flicker).toEqual({ kind: "NOISE", speed: 9, amount: 0.25 });
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
    expect(compiled.lightDefs.some((l) => l.shape === "STREET_LAMP")).toBe(true);
    expect(compiled.blockedTiles.has("3,2")).toBe(false);
  });
});
