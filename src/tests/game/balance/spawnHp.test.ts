import { describe, expect, test } from "vitest";
import { computeSpawnHpFromPower } from "../../../game/balance/spawnHp";
import type { EnemyPowerCostConfig } from "../../../game/balance/enemyPower";
import type { ExpectedPowerConfig } from "../../../game/balance/expectedPower";

const expectedCfg: ExpectedPowerConfig = {
  timeCurve: [{ tSec: 0, dps: 20 }, { tSec: 10, dps: 60 }],
  depthMultBase: 1,
  depthMultPerDepth: 0,
  depthMultMin: 1,
  depthMultMax: 1,
};

const powerCfg: EnemyPowerCostConfig = {
  costs: {
    trash: 1,
    elite: 2,
    tank: 4,
    ranged: 0.9,
    swarm: 0.6,
  },
  hpWeight: {
    trash: 1,
    elite: 1,
    tank: 1,
    ranged: 1,
    swarm: 1,
  },
};

describe("computeSpawnHpFromPower", () => {
  test("trash hp follows expected dps at parity cost", () => {
    expect(computeSpawnHpFromPower(expectedCfg, powerCfg, 0, 1, "trash")).toBe(20);
    expect(computeSpawnHpFromPower(expectedCfg, powerCfg, 10, 1, "trash")).toBe(60);
  });

  test("hp weight applies multiplicatively", () => {
    const cfg2: EnemyPowerCostConfig = {
      ...powerCfg,
      hpWeight: { ...powerCfg.hpWeight, trash: 1.5 },
    };
    expect(computeSpawnHpFromPower(expectedCfg, cfg2, 0, 1, "trash")).toBe(30);
  });
});

