import { describe, expect, it } from "vitest";

import { loadTableMapDefFromJson } from "../../../../../game/map/formats/json/jsonMapLoader";
import jsonMinimalMap from "../../../../../game/map/authored/maps/jsonMaps/minimal.json";
import jsonDocksMap from "../../../../../game/map/authored/maps/jsonMaps/docks.json";

describe("jsonMapLoader", () => {
  it("converts a minimal JSON map into an equivalent TableMapDef", () => {
    const mapDef = loadTableMapDefFromJson(jsonMinimalMap, "authored/maps/jsonMaps/minimal.json");

    expect(mapDef).toMatchObject({
      id: "JSON_MINIMAL",
      w: 3,
      h: 3,
      cells: [
        { x: 0, y: 0, type: "floor", z: 0 },
        { x: 1, y: 0, type: "floor", z: 0 },
        { x: 2, y: 0, type: "floor", z: 0 },

        { x: 0, y: 1, type: "floor", z: 0 },
        { x: 1, y: 1, type: "spawn", z: 0 },
        { x: 2, y: 1, type: "floor", z: 0 },

        { x: 0, y: 2, type: "floor", z: 0 },
        { x: 1, y: 2, type: "floor", z: 0 },
        { x: 2, y: 2, type: "floor", z: 0 },
      ],
    });
  });

  it("parses optional map-authored lights", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "LIGHTS_TEST",
      width: 2,
      height: 2,
      cells: [{ x: 0, y: 0, type: "floor", z: 0 }],
      lights: [{ x: 3, y: 4, heightUnits: 2, radiusPx: 120, intensity: 0.65 }],
    }, "inline");

    expect(mapDef.lights).toEqual([
      { x: 3, y: 4, heightUnits: 2, radiusPx: 120, intensity: 0.65 },
    ]);
  });

  it("parses light colorMode and strength fields", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "LIGHTS_MODE_STRENGTH_TEST",
      width: 2,
      height: 2,
      cells: [{ x: 0, y: 0, type: "floor", z: 0 }],
      lights: [{
        x: 1,
        y: 1,
        radiusPx: 120,
        intensity: 0.65,
        colorMode: "palette",
        strength: "high",
        color: "#ffaa44",
      }],
    }, "inline");

    expect(mapDef.lights?.[0]).toMatchObject({
      colorMode: "palette",
      strength: "high",
      color: "#ffaa44",
    });
  });

  it("parses street lamp semantic light fields", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "LIGHTS_SEMANTIC_TEST",
      width: 2,
      height: 2,
      cells: [{ x: 0, y: 0, type: "floor", z: 0 }],
      lights: [{
        x: 1,
        y: 1,
        radiusPx: 140,
        intensity: 0.8,
        shape: "STREET_LAMP",
        semanticType: "street_lamp_s",
        pool: { radiusPx: 120, yScale: 0.65 },
        cone: { dirRad: 1.57, angleRad: 0.9, lengthPx: 260 },
      }],
    }, "inline");

    expect(mapDef.lights?.[0]).toMatchObject({
      x: 1,
      y: 1,
      radiusPx: 140,
      intensity: 0.8,
      shape: "STREET_LAMP",
      semanticType: "street_lamp_s",
      pool: { radiusPx: 120, yScale: 0.65 },
      cone: { dirRad: 1.57, angleRad: 0.9, lengthPx: 260 },
    });
  });

  it("parses neon semantic light fields with color+tintStrength overrides", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "LIGHTS_NEON_TEST",
      width: 2,
      height: 2,
      cells: [{ x: 0, y: 0, type: "floor", z: 0 }],
      lights: [{
        x: 1,
        y: 1,
        radiusPx: 180,
        intensity: 0.7,
        semanticType: "neon_sign_pink",
        color: "#ff00ff",
        tintStrength: 0.8,
      }],
    }, "inline");

    expect(mapDef.lights?.[0]).toMatchObject({
      semanticType: "neon_sign_pink",
      color: "#ff00ff",
      tintStrength: 0.8,
    });
  });

  it("parses light flicker configuration", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "LIGHTS_FLICKER_TEST",
      width: 1,
      height: 1,
      cells: [{ x: 0, y: 0, type: "floor", z: 0 }],
      lights: [{
        x: 0,
        y: 0,
        radiusPx: 120,
        intensity: 0.7,
        flicker: { kind: "NOISE", speed: 9, amount: 0.25 },
      }],
    }, "inline");
    expect(mapDef.lights?.[0].flicker).toEqual({ kind: "NOISE", speed: 9, amount: 0.25 });
  });

  it("preserves skinId on building semantic fields", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "FIELD_BUILDING_SKINID_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 2, y: 2, z: 0, type: "building", w: 4, h: 4, skinId: "downtown_2" }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: 2,
          y: 2,
          z: 0,
          type: "building",
          w: 4,
          h: 4,
          skinId: "downtown_2",
        }),
      ]),
    );
  });

  it("normalizes building dir from fields to cardinal uppercase", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "FIELD_BUILDING_DIR_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 2, y: 2, z: 0, type: "building", w: 4, h: 4, skinId: "downtown_2", dir: "e" }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          skinId: "downtown_2",
          dir: "E",
        }),
      ]),
    );
  });

  it("preserves building dir from authored stamps", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "STAMP_BUILDING_DIR_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", w: 5, h: 7, skinId: "downtown_1", dir: "N" }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          skinId: "downtown_1",
          dir: "N",
        }),
      ]),
    );
  });

  it("rejects diagonal dir for buildings", () => {
    expect(() => loadTableMapDefFromJson({
      id: "FIELD_BUILDING_DIAGONAL_DIR_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 2, y: 2, z: 0, type: "building", w: 4, h: 4, skinId: "downtown_2", dir: "NE" }],
    }, "inline")).toThrow(/fields\[0\]\.dir must be cardinal for buildings/i);
  });

  it("rejects building dir+flipped combinations", () => {
    expect(() => loadTableMapDefFromJson({
      id: "STAMP_BUILDING_DIR_FLIPPED_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 2, y: 2, z: 0, type: "building", w: 5, h: 7, skinId: "downtown_1", dir: "E", flipped: true }],
    }, "inline")).toThrow(/cannot define both dir and flipped/i);
  });

  it("preserves building perimeter layout from fields", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "FIELD_BUILDING_LAYOUT_TEST",
      width: 12,
      height: 12,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, layout: "perimeter_outward" }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
        }),
      ]),
    );
  });

  it("preserves building perimeter layout from authored stamps", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "STAMP_BUILDING_LAYOUT_TEST",
      width: 12,
      height: 12,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, layout: "perimeter_outward" }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
        }),
      ]),
    );
  });

  it("rejects layout on non-building entries", () => {
    expect(() => loadTableMapDefFromJson({
      id: "FIELD_NON_BUILDING_LAYOUT_TEST",
      width: 8,
      height: 8,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 2, y: 2, z: 0, type: "road", w: 2, h: 2, layout: "perimeter_outward" }],
    }, "inline")).toThrow(/layout is only supported for type=building/i);
  });

  it("allows perimeter layout with dir and rejects flipped", () => {
    const withDir = loadTableMapDefFromJson({
      id: "STAMP_BUILDING_LAYOUT_DIR_TEST",
      width: 12,
      height: 12,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, layout: "perimeter_outward", dir: "S" }],
    }, "inline");
    expect(withDir.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
          dir: "S",
        }),
      ]),
    );

    expect(() => loadTableMapDefFromJson({
      id: "STAMP_BUILDING_LAYOUT_FLIPPED_TEST",
      width: 12,
      height: 12,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, layout: "perimeter_outward", flipped: true }],
    }, "inline")).toThrow(/cannot define flipped when layout=perimeter_outward/i);
  });

  it("applies root layout to building fields when field layout is omitted", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "ROOT_LAYOUT_FIELDS_TEST",
      width: 12,
      height: 12,
      layout: "perimeter_outward",
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8 }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
        }),
      ]),
    );
  });

  it("applies root layout to authored building stamps when stamp layout is omitted", () => {
    const mapDef = loadTableMapDefFromJson({
      id: "ROOT_LAYOUT_STAMPS_TEST",
      width: 12,
      height: 12,
      layout: "perimeter_outward",
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8 }],
    }, "inline");

    expect(mapDef.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
        }),
      ]),
    );
  });

  it("allows root perimeter layout with dir and rejects flipped", () => {
    const withDir = loadTableMapDefFromJson({
      id: "ROOT_LAYOUT_DIR_CONFLICT_TEST",
      width: 12,
      height: 12,
      layout: "perimeter_outward",
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      fields: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, dir: "S" }],
    }, "inline");
    expect(withDir.stamps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "building",
          layout: "perimeter_outward",
          dir: "S",
        }),
      ]),
    );

    expect(() => loadTableMapDefFromJson({
      id: "ROOT_LAYOUT_FLIPPED_CONFLICT_TEST",
      width: 12,
      height: 12,
      layout: "perimeter_outward",
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 1, y: 1, z: 0, type: "building", w: 8, h: 8, flipped: true }],
    }, "inline")).toThrow(/cannot define flipped when layout=perimeter_outward/i);
  });

  it("surrounds DOCKS chunk-grid with one 24x24 ocean chunk border at z=-2", () => {
    const mapDef = loadTableMapDefFromJson(jsonDocksMap, "authored/maps/jsonMaps/docks.json");

    expect(mapDef.w).toBe(24 * (3 + 2));
    expect(mapDef.h).toBe(24 * (3 + 2));

    const hasOceanAt = (x: number, y: number) =>
      mapDef.cells.some((c) => c.x === x && c.y === y && c.type === "ocean" && c.z === -2);

    expect(hasOceanAt(0, 0)).toBe(true);
    expect(hasOceanAt(24 * 5 - 1, 0)).toBe(true);
    expect(hasOceanAt(0, 24 * 5 - 1)).toBe(true);
    expect(hasOceanAt(24 * 5 - 1, 24 * 5 - 1)).toBe(true);
    expect(hasOceanAt(0, 24 * 2)).toBe(true);
    expect(hasOceanAt(24 * 5 - 1, 24 * 2)).toBe(true);
    const interiorOceanCount = mapDef.cells.filter((c) =>
      c.type === "ocean" && c.z === -2 && c.x >= 24 && c.x < (24 * 4) && c.y >= 24 && c.y < (24 * 4)
    ).length;
    expect(interiorOceanCount).toBeGreaterThan(0);

    const covered = new Set<string>();
    for (let i = 0; i < mapDef.cells.length; i++) {
      const c = mapDef.cells[i];
      covered.add(`${c.x},${c.y}`);
    }
    expect(covered.size).toBe(mapDef.w * mapDef.h);
  });
});
