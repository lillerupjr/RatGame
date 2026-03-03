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
