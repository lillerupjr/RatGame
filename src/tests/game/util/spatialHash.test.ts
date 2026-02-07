// src/game/util/spatialHash.test.ts
// @ts-ignore
import { describe, it, expect, beforeEach } from "vitest";
import {
  createSpatialHash,
  clearSpatialHash,
  insertEntity,
  queryCircle,
  type SpatialHash,
} from "../../../game/util/spatialHash";

describe("spatialHash", () => {
  let hash: SpatialHash;

  beforeEach(() => {
    hash = createSpatialHash(100); // 100px cell size
  });

  describe("createSpatialHash", () => {
    it("should create empty spatial hash", () => {
      const h = createSpatialHash(50);
      expect(h.cellSize).toBe(50);
      expect(h.cells.size).toBe(0);
    });
  });

  describe("clearSpatialHash", () => {
    it("should clear all entities", () => {
      insertEntity(hash, 0, 50, 50, 10);
      insertEntity(hash, 1, 150, 150, 10);

      clearSpatialHash(hash);

      expect(hash.cells.size).toBe(0);
    });
  });

  describe("insertEntity", () => {
    it("should insert entity into correct cell", () => {
      insertEntity(hash, 0, 50, 50, 10);

      const results = queryCircle(hash, 50, 50, 20);
      expect(results).toContain(0);
    });

    it("should handle entities at cell boundaries", () => {
      // Entity at exactly (100, 100) with radius spanning multiple cells
      insertEntity(hash, 0, 100, 100, 60);

      // Should be found from any neighboring cell
      const results = queryCircle(hash, 150, 150, 100);
      expect(results).toContain(0);
    });

    it("should insert large entities into multiple cells", () => {
      // Large entity that spans multiple cells
      insertEntity(hash, 0, 150, 150, 80);

      // Should be queryable from different positions
      const results1 = queryCircle(hash, 100, 100, 50);
      const results2 = queryCircle(hash, 200, 200, 50);

      expect(results1).toContain(0);
      expect(results2).toContain(0);
    });
  });

  describe("queryCircle", () => {
    it("should find entities within query radius", () => {
      insertEntity(hash, 0, 50, 50, 10);
      insertEntity(hash, 1, 60, 60, 10);
      insertEntity(hash, 2, 500, 500, 10);

      const results = queryCircle(hash, 55, 55, 50);

      expect(results).toContain(0);
      expect(results).toContain(1);
      expect(results).not.toContain(2);
    });

    it("should return empty array when no entities in range", () => {
      insertEntity(hash, 0, 1000, 1000, 10);

      const results = queryCircle(hash, 0, 0, 50);

      expect(results.length).toBe(0);
    });

    it("should handle query at negative coordinates", () => {
      insertEntity(hash, 0, -50, -50, 10);

      const results = queryCircle(hash, -40, -40, 30);

      expect(results).toContain(0);
    });

    it("should return entities that span multiple cells (deduplication handled by caller)", () => {
      // Large entity spanning multiple cells
      insertEntity(hash, 0, 150, 150, 80);

      // Query that covers multiple cells
      const results = queryCircle(hash, 150, 150, 100);

      // Entity should be found (caller is responsible for deduplication)
      expect(results).toContain(0);
    });
  });

  describe("performance characteristics", () => {
    it("should efficiently query sparse entities", () => {
      // Insert many entities spread across large area
      for (let i = 0; i < 1000; i++) {
        insertEntity(hash, i, i * 50, i * 50, 10);
      }

      // Query a small area - should only check nearby cells
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        queryCircle(hash, 100, 100, 50);
      }
      const endTime = performance.now();

      // Should complete quickly (less than 50ms for 100 queries)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
