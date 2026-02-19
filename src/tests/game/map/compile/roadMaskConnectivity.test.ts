import { describe, expect, it } from "vitest";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";
import { loadTableMapDefFromJson } from "../../../../game/map/formats/json/jsonMapLoader";
import type { TableMapDef } from "../../../../game/map/formats/table/tableMapTypes";

describe("canonical road semantic world masks", () => {
  it("builds deterministic roadAreaMaskWorld + roadCenterMaskWorld + roadCenterWidthWorld from semantic roads", () => {
    const mapDef: TableMapDef = {
      id: "road_semantic_basic",
      w: 12,
      h: 10,
      cells: [],
      roadSemanticRects: [
        { x: 1, y: 2, w: 9, h: 5 },
      ],
      stamps: [
        { x: 1, y: 2, w: 9, h: 5, type: "road", z: 0 },
      ],
    };

    const a = compileKenneyMapFromTable(mapDef, { runSeed: 123, mapId: mapDef.id });
    const b = compileKenneyMapFromTable(mapDef, { runSeed: 123, mapId: mapDef.id });
    const idx = (tx: number, ty: number) => (tx - a.originTx) + (ty - a.originTy) * a.width;

    expect(a.roadAreaMaskWorld.length).toBe(mapDef.w * mapDef.h);
    expect(a.roadCenterMaskWorld.length).toBe(mapDef.w * mapDef.h);
    expect(a.roadCenterWidthWorld.length).toBe(mapDef.w * mapDef.h);
    expect(Array.from(a.roadAreaMaskWorld)).toEqual(Array.from(b.roadAreaMaskWorld));
    expect(Array.from(a.roadCenterMaskWorld)).toEqual(Array.from(b.roadCenterMaskWorld));
    expect(Array.from(a.roadCenterWidthWorld)).toEqual(Array.from(b.roadCenterWidthWorld));

    expect(a.isRoadWorld(1, 2)).toBe(true);
    expect(a.isRoadWorld(9, 6)).toBe(true);
    expect(a.isRoadWorld(0, 2)).toBe(false);

    // Center row is y=2+floor(5/2)=4 with width=5
    expect(a.roadCenterMaskWorld[idx(1, 4)]).toBe(1);
    expect(a.roadCenterMaskWorld[idx(9, 4)]).toBe(1);
    expect(a.roadCenterMaskWorld[idx(1, 3)]).toBe(0);
    expect(a.roadCenterWidthWorld[idx(1, 4)]).toBe(5);
    expect(a.roadCenterWidthWorld[idx(9, 4)]).toBe(5);
  });

  it("derives road centerlines from semantic road rectangles", () => {
    const mapDef: TableMapDef = {
      id: "road_centerline_rects",
      w: 16,
      h: 16,
      cells: [],
      roadSemanticRects: [
        { x: 1, y: 2, w: 9, h: 5 },  // horizontal center row y=4
        { x: 11, y: 1, w: 5, h: 11 }, // vertical center col x=13
        { x: 4, y: 9, w: 5, h: 5 },   // square "+" center at (6,11)
      ],
      stamps: [
        { x: 1, y: 2, w: 9, h: 5, type: "road", z: 0 },
        { x: 11, y: 1, w: 5, h: 11, type: "road", z: 0 },
        { x: 4, y: 9, w: 5, h: 5, type: "road", z: 0 },
      ],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 1, mapId: mapDef.id });
    const idx = (tx: number, ty: number) => (tx - compiled.originTx) + (ty - compiled.originTy) * compiled.width;
    const center = (tx: number, ty: number) => compiled.roadCenterMaskWorld[idx(tx, ty)] === 1;
    const width = (tx: number, ty: number) => compiled.roadCenterWidthWorld[idx(tx, ty)] | 0;

    expect(center(1, 4)).toBe(true);
    expect(center(9, 4)).toBe(true);
    expect(center(1, 3)).toBe(false);
    expect(width(1, 4)).toBe(5);

    expect(center(13, 1)).toBe(true);
    expect(center(13, 11)).toBe(true);
    expect(center(12, 1)).toBe(false);
    expect(width(13, 1)).toBe(5);

    expect(center(4, 11)).toBe(true);
    expect(center(8, 11)).toBe(true);
    expect(center(6, 9)).toBe(true);
    expect(center(6, 13)).toBe(true);
    expect(center(5, 10)).toBe(false);
    expect(width(6, 11)).toBe(5);

    // Invariant: centerline tile must be road area tile.
    for (let ty = compiled.originTy; ty < compiled.originTy + compiled.height; ty++) {
      for (let tx = compiled.originTx; tx < compiled.originTx + compiled.width; tx++) {
        const i = idx(tx, ty);
        if (compiled.roadCenterMaskWorld[i] === 1) {
          expect(compiled.roadAreaMaskWorld[i]).toBe(1);
          expect(compiled.roadCenterWidthWorld[i]).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps road area and centerline stable across chunk borders", () => {
    const stitched = loadTableMapDefFromJson({
      id: "road_chunk_boundary",
      chunkGrid: { id: "test_buildings", cols: 2, rows: 1 },
    });
    const compiled = compileKenneyMapFromTable(stitched, { runSeed: 7, mapId: stitched.id });
    const idx = (tx: number, ty: number) => (tx - compiled.originTx) + (ty - compiled.originTy) * compiled.width;
    const seamLeft = 23;
    const seamRight = 24;
    const rects = stitched.roadSemanticRects ?? [];
    const leftRect = rects.find((r) => {
      const x0 = r.x;
      const x1 = r.x + r.w - 1;
      return x0 <= seamLeft && seamLeft <= x1;
    });
    const rightRect = rects.find((r) => {
      const x0 = r.x;
      const x1 = r.x + r.w - 1;
      return x0 <= seamRight && seamRight <= x1;
    });

    expect(leftRect).toBeTruthy();
    expect(rightRect).toBeTruthy();

    const yMin = Math.max(leftRect!.y, rightRect!.y);
    const yMax = Math.min(leftRect!.y + leftRect!.h - 1, rightRect!.y + rightRect!.h - 1);
    expect(yMin <= yMax).toBe(true);
    const yMid = yMin + Math.floor((yMax - yMin) / 2);
    expect(compiled.roadAreaMaskWorld[idx(seamLeft, yMid)]).toBe(1);
    expect(compiled.roadAreaMaskWorld[idx(seamRight, yMid)]).toBe(1);

    if (leftRect!.w >= leftRect!.h && rightRect!.w >= rightRect!.h) {
      const leftCenterY = leftRect!.y + Math.floor(leftRect!.h / 2);
      const rightCenterY = rightRect!.y + Math.floor(rightRect!.h / 2);
      expect(leftCenterY).toBe(rightCenterY);
      expect(compiled.roadCenterMaskWorld[idx(seamLeft, leftCenterY)]).toBe(1);
      expect(compiled.roadCenterMaskWorld[idx(seamRight, rightCenterY)]).toBe(1);
      expect(compiled.roadCenterWidthWorld[idx(seamLeft, leftCenterY)]).toBe(leftRect!.h);
      expect(compiled.roadCenterWidthWorld[idx(seamRight, rightCenterY)]).toBe(rightRect!.h);
    } else {
      const leftCenterX = leftRect!.x + Math.floor(leftRect!.w / 2);
      const rightCenterX = rightRect!.x + Math.floor(rightRect!.w / 2);
      expect(compiled.roadCenterMaskWorld[idx(leftCenterX, yMid)]).toBe(1);
      expect(compiled.roadCenterMaskWorld[idx(rightCenterX, yMid)]).toBe(1);
      expect(compiled.roadCenterWidthWorld[idx(leftCenterX, yMid)]).toBe(leftRect!.w);
      expect(compiled.roadCenterWidthWorld[idx(rightCenterX, yMid)]).toBe(rightRect!.w);
    }
  });

  it("merges long-edge-adjacent road rects before centerline width derivation", () => {
    const mapDef: TableMapDef = {
      id: "road_rect_merge_long_edge",
      w: 64,
      h: 32,
      cells: [],
      roadSemanticRects: [
        { x: 10, y: 10, w: 30, h: 1 },
        { x: 10, y: 11, w: 30, h: 1 },
      ],
      stamps: [
        { x: 10, y: 10, w: 30, h: 1, type: "road", z: 0 },
        { x: 10, y: 11, w: 30, h: 1, type: "road", z: 0 },
      ],
    };

    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 1, mapId: mapDef.id });
    const idx = (tx: number, ty: number) => (tx - compiled.originTx) + (ty - compiled.originTy) * compiled.width;

    // Area remains 2-tiles thick for full segment
    expect(compiled.roadAreaMaskWorld[idx(10, 10)]).toBe(1);
    expect(compiled.roadAreaMaskWorld[idx(10, 11)]).toBe(1);
    expect(compiled.roadAreaMaskWorld[idx(39, 10)]).toBe(1);
    expect(compiled.roadAreaMaskWorld[idx(39, 11)]).toBe(1);

    // After merge => one rect 30x2, centerline band marks BOTH rows y=10 and y=11, width=2
    expect(compiled.roadCenterMaskWorld[idx(10, 10)]).toBe(1);
    expect(compiled.roadCenterMaskWorld[idx(39, 10)]).toBe(1);
    expect(compiled.roadCenterMaskWorld[idx(10, 11)]).toBe(1);
    expect(compiled.roadCenterMaskWorld[idx(39, 11)]).toBe(1);
    expect(compiled.roadCenterWidthWorld[idx(10, 10)]).toBe(2);
    expect(compiled.roadCenterWidthWorld[idx(39, 10)]).toBe(2);
    expect(compiled.roadCenterWidthWorld[idx(10, 11)]).toBe(2);
    expect(compiled.roadCenterWidthWorld[idx(39, 11)]).toBe(2);
  });

  it("builds width-aware roadIntersectionMaskWorld for mixed-width crossings", () => {
    const mapDef: TableMapDef = {
      id: "road_intersection_mixed_width",
      w: 40,
      h: 40,
      cells: [],
      roadSemanticRects: [
        { x: 5, y: 15, w: 30, h: 5 }, // horizontal width 5
        { x: 20, y: 8, w: 2, h: 24 }, // vertical width 2
      ],
      stamps: [
        { x: 5, y: 15, w: 30, h: 5, type: "road", z: 0 },
        { x: 20, y: 8, w: 2, h: 24, type: "road", z: 0 },
      ],
    };
    const compiled = compileKenneyMapFromTable(mapDef, { runSeed: 9, mapId: mapDef.id });
    const idx = (tx: number, ty: number) => (tx - compiled.originTx) + (ty - compiled.originTy) * compiled.width;

    // Straight-only centerline segment away from crossing should not be intersection.
    expect(compiled.roadCenterMaskWorld[idx(8, 17)]).toBe(1);
    expect(compiled.roadIntersectionMaskWorld[idx(8, 17)]).toBe(0);

    // Intersection mask must stay inside road area.
    for (let ty = compiled.originTy; ty < compiled.originTy + compiled.height; ty++) {
      for (let tx = compiled.originTx; tx < compiled.originTx + compiled.width; tx++) {
        const i = idx(tx, ty);
        if (compiled.roadIntersectionMaskWorld[i] === 1) {
          expect(compiled.roadAreaMaskWorld[i]).toBe(1);
        }
      }
    }

    // Mandatory metric: 5x2 crossing produces exactly 10 intersection tiles.
    let intersectionCount = 0;
    let crossingCount = 0;
    let stopCount = 0;
    let overlapIntersectionCrossing = 0;
    let overlapStopWithIntersectionOrCrossing = 0;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < compiled.roadAreaMaskWorld.length; i++) {
      const isIntersection = compiled.roadIntersectionMaskWorld[i] === 1;
      const isCrossing = compiled.roadCrossingMaskWorld[i] === 1;
      const isStop = compiled.roadStopMaskWorld[i] === 1;
      if (isIntersection) {
        intersectionCount++;
        const ty = Math.floor(i / compiled.width) + compiled.originTy;
        const tx = (i % compiled.width) + compiled.originTx;
        if (tx < minX) minX = tx;
        if (tx > maxX) maxX = tx;
        if (ty < minY) minY = ty;
        if (ty > maxY) maxY = ty;
      }
      if (isCrossing) crossingCount++;
      if (isStop) stopCount++;
      if (isIntersection && isCrossing) overlapIntersectionCrossing++;
      if (isStop && (isIntersection || isCrossing)) overlapStopWithIntersectionOrCrossing++;
    }
    expect(intersectionCount).toBe(10);
    expect(crossingCount).toBeGreaterThan(0);
    expect(stopCount).toBeGreaterThan(0);
    expect(overlapIntersectionCrossing).toBe(0);
    expect(overlapStopWithIntersectionOrCrossing).toBe(0);
    const bboxW = maxX - minX + 1;
    const bboxH = maxY - minY + 1;
    expect(bboxW * bboxH).toBe(10);
    const dims = [bboxW, bboxH].sort((a, b) => a - b);
    expect(dims).toEqual([2, 5]);

    // Placement invariant: cyan bbox center must match overlap-component bbox center (half-tile space).
    let oMinX = Number.POSITIVE_INFINITY;
    let oMinY = Number.POSITIVE_INFINITY;
    let oMaxX = Number.NEGATIVE_INFINITY;
    let oMaxY = Number.NEGATIVE_INFINITY;
    for (let ty = compiled.originTy; ty < compiled.originTy + compiled.height; ty++) {
      for (let tx = compiled.originTx; tx < compiled.originTx + compiled.width; tx++) {
        const i = idx(tx, ty);
        const overlap = compiled.roadCenterMaskHWorld[i] === 1 && compiled.roadCenterMaskVWorld[i] === 1;
        if (!overlap) continue;
        if (tx < oMinX) oMinX = tx;
        if (tx > oMaxX) oMaxX = tx;
        if (ty < oMinY) oMinY = ty;
        if (ty > oMaxY) oMaxY = ty;
      }
    }
    const overlapAnchor2X = oMinX + oMaxX + 1;
    const overlapAnchor2Y = oMinY + oMaxY + 1;
    const cyanAnchor2X = minX + maxX + 1;
    const cyanAnchor2Y = minY + maxY + 1;
    expect(cyanAnchor2X).toBe(overlapAnchor2X);
    expect(cyanAnchor2Y).toBe(overlapAnchor2Y);

    // Placement must align to overlap-component anchor with exact wH x wV footprint.
    let wH = 0;
    let wV = 0;
    for (let ty = compiled.originTy; ty < compiled.originTy + compiled.height; ty++) {
      for (let tx = compiled.originTx; tx < compiled.originTx + compiled.width; tx++) {
        const i = idx(tx, ty);
        if (compiled.roadCenterMaskHWorld[i] === 1 && compiled.roadCenterMaskVWorld[i] === 1) {
          // Match runtime footprint-axis convention:
          // X span width from V band, Y span width from H band.
          wH = Math.max(wH, compiled.roadCenterWidthVWorld[i] | 0);
          wV = Math.max(wV, compiled.roadCenterWidthHWorld[i] | 0);
        }
      }
    }
    const rectBoundsFromCenter2 = (c2: number, w: number): { a: number; b: number } => {
      const a = Math.floor((c2 - w) / 2);
      return { a, b: a + w - 1 };
    };
    const xb = rectBoundsFromCenter2(overlapAnchor2X, wH);
    const yb = rectBoundsFromCenter2(overlapAnchor2Y, wV);
    const expectedX0 = xb.a;
    const expectedX1 = xb.b;
    const expectedY0 = yb.a;
    const expectedY1 = yb.b;
    for (let yy = expectedY0; yy <= expectedY1; yy++) {
      for (let xx = expectedX0; xx <= expectedX1; xx++) {
        expect(compiled.roadIntersectionMaskWorld[idx(xx, yy)]).toBe(1);
      }
    }
  });
});
