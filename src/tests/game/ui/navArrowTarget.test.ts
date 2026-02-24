import { describe, expect, test } from "vitest";
import { resolveNavArrowTarget } from "../../../game/ui/navArrowTarget";

describe("resolveNavArrowTarget", () => {
  test("BOSS_TRIPLE returns nearest uncompleted boss spawn", () => {
    const world: any = {
      floorArchetype: "BOSS_TRIPLE",
      playerWorld: { x: 0, y: 0 },
      bossTriple: {
        spawnPointsWorld: [
          { x: 100, y: 0 },
          { x: 20, y: 0 },
        ],
        completed: [false, true],
      },
    };

    const out = resolveNavArrowTarget(world);
    expect(out).toEqual({ kind: "BOSS", worldX: 100, worldY: 0 });
  });

  test("BOSS_TRIPLE returns null when all bosses completed", () => {
    const world: any = {
      floorArchetype: "BOSS_TRIPLE",
      playerWorld: { x: 0, y: 0 },
      bossTriple: {
        spawnPointsWorld: [{ x: 100, y: 0 }],
        completed: [true],
      },
    };

    expect(resolveNavArrowTarget(world)).toBeNull();
  });

  test("ZONE_TRIAL/TIME_TRIAL returns nearest uncompleted zone center", () => {
    const world: any = {
      floorArchetype: "TIME_TRIAL",
      playerWorld: { x: 0, y: 0 },
      tileWorld: 10,
      zoneTrial: {
        zones: [
          { tx: 20, ty: 0, w: 4, h: 4, completed: false },
          { tx: 2, ty: 0, w: 2, h: 2, completed: false },
          { tx: 1, ty: 1, w: 1, h: 1, completed: true },
        ],
      },
    };

    const out = resolveNavArrowTarget(world);
    expect(out?.kind).toBe("ZONE");
    expect(out?.worldX).toBeCloseTo((2 + 1) * 10);
    expect(out?.worldY).toBeCloseTo((0 + 1) * 10);
  });

  test("ZONE_TRIAL applies zone-trial map origin offset", () => {
    const world: any = {
      floorArchetype: "TIME_TRIAL",
      playerWorld: { x: 0, y: 0 },
      tileWorld: 10,
      zoneTrial: {
        originTx: 100,
        originTy: 50,
        zones: [{ tx: 2, ty: 3, w: 2, h: 2, completed: false }],
      },
    };

    const out = resolveNavArrowTarget(world);
    expect(out?.kind).toBe("ZONE");
    expect(out?.worldX).toBeCloseTo((100 + 2 + 1) * 10);
    expect(out?.worldY).toBeCloseTo((50 + 3 + 1) * 10);
  });

  test("BOSS_TRIPLE takes priority over zone data", () => {
    const world: any = {
      floorArchetype: "BOSS_TRIPLE",
      playerWorld: { x: 0, y: 0 },
      bossTriple: {
        spawnPointsWorld: [{ x: 300, y: 0 }],
        completed: [false],
      },
      zoneTrial: {
        zones: [{ tx: 1, ty: 1, w: 1, h: 1, completed: false }],
      },
    };

    const out = resolveNavArrowTarget(world);
    expect(out).toEqual({ kind: "BOSS", worldX: 300, worldY: 0 });
  });
});
