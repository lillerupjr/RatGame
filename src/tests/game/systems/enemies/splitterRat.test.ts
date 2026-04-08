import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../../engine/render/kenneyTiles";
import { makeUnknownDamageMeta } from "../../../../game/combat/damageMeta";
import { stageDocks } from "../../../../game/content/stages";
import { EnemyId, spawnEnemyGrid } from "../../../../game/factories/enemyFactory";
import { getEnemyWorld } from "../../../../game/coords/worldViews";
import { ensureEnemyBrain } from "../../../../game/systems/enemies/brain";
import { finalizeEnemyDeath } from "../../../../game/systems/enemies/finalize";
import { queryCircle } from "../../../../game/util/spatialHash";

function aliveSplittersAtStage(world: ReturnType<typeof createWorld>, stage: number): number[] {
  return world.eAlive
    .map((alive, index) => (alive && world.eType[index] === EnemyId.SPLITTER && world.eSplitStage[index] === stage ? index : -1))
    .filter((index) => index >= 0);
}

describe("Splitter Rat", () => {
  test("spawn overrides resolve staged hp, damage, radius, reward base life, and visual scale", () => {
    const world = createWorld({ seed: 12_001, stage: stageDocks });

    const stage0 = spawnEnemyGrid(world, EnemyId.SPLITTER, 8, 8, KENNEY_TILE_WORLD);
    const stage1 = spawnEnemyGrid(world, EnemyId.SPLITTER, 9, 8, KENNEY_TILE_WORLD, { splitStage: 1 });
    const stage2 = spawnEnemyGrid(world, EnemyId.SPLITTER, 10, 8, KENNEY_TILE_WORLD, { splitStage: 2 });

    expect(world.eSplitStage[stage0]).toBe(0);
    expect(world.eVisualScale[stage0]).toBeCloseTo(1, 6);
    expect(world.eHpMax[stage0]).toBe(100);
    expect(world.eDamage[stage0]).toBe(12);
    expect(world.eR[stage0]).toBeCloseTo(14, 6);
    expect(world.eBaseLife[stage0]).toBe(100);

    expect(world.eSplitStage[stage1]).toBe(1);
    expect(world.eVisualScale[stage1]).toBeCloseTo(0.5, 6);
    expect(world.eHpMax[stage1]).toBe(50);
    expect(world.eDamage[stage1]).toBe(6);
    expect(world.eR[stage1]).toBeCloseTo(7, 6);
    expect(world.eBaseLife[stage1]).toBe(50);

    expect(world.eSplitStage[stage2]).toBe(2);
    expect(world.eVisualScale[stage2]).toBeCloseTo(0.25, 6);
    expect(world.eHpMax[stage2]).toBe(25);
    expect(world.eDamage[stage2]).toBe(3);
    expect(world.eR[stage2]).toBeCloseTo(6, 6);
    expect(world.eBaseLife[stage2]).toBe(25);
  });

  test("death-finalizer spawns staged children and stops splitting at stage 2", () => {
    const world = createWorld({ seed: 12_002, stage: stageDocks });
    const root = spawnEnemyGrid(world, EnemyId.SPLITTER, 8, 8, KENNEY_TILE_WORLD);
    const rootWorld = getEnemyWorld(world, root, KENNEY_TILE_WORLD);

    expect(finalizeEnemyDeath(world, root, {
      damageMeta: makeUnknownDamageMeta("splitter_root"),
      source: "OTHER",
    })).toBe(true);

    const stage1Children = aliveSplittersAtStage(world, 1);
    expect(stage1Children).toHaveLength(2);
    for (const child of stage1Children) {
      expect(world.eType[child]).toBe(EnemyId.SPLITTER);
      expect(world.eVisualScale[child]).toBeCloseTo(0.5, 6);
      expect(world.eHpMax[child]).toBe(50);
      expect(ensureEnemyBrain(world, child).state).toBe("move");
      const knockMag = Math.hypot(
        ((world as any)._eKnockVx?.[child] ?? 0) as number,
        ((world as any)._eKnockVy?.[child] ?? 0) as number,
      );
      expect(knockMag).toBeGreaterThan(0);
    }

    const nearbyAfterRoot = new Set(queryCircle(world.enemySpatialHash, rootWorld.wx, rootWorld.wy, 64));
    expect(stage1Children.every((child) => nearbyAfterRoot.has(child))).toBe(true);

    expect(finalizeEnemyDeath(world, stage1Children[0], {
      damageMeta: makeUnknownDamageMeta("splitter_stage1_a"),
      source: "OTHER",
    })).toBe(true);
    expect(aliveSplittersAtStage(world, 1)).toHaveLength(1);
    expect(aliveSplittersAtStage(world, 2)).toHaveLength(2);

    expect(finalizeEnemyDeath(world, stage1Children[1], {
      damageMeta: makeUnknownDamageMeta("splitter_stage1_b"),
      source: "OTHER",
    })).toBe(true);
    const stage2Children = aliveSplittersAtStage(world, 2);
    expect(stage2Children).toHaveLength(4);
    for (const child of stage2Children) {
      expect(world.eType[child]).toBe(EnemyId.SPLITTER);
      expect(world.eVisualScale[child]).toBeCloseTo(0.25, 6);
      expect(world.eHpMax[child]).toBe(25);
    }

    const totalEnemiesBeforeStage2Deaths = world.eAlive.length;
    for (const child of stage2Children) {
      expect(finalizeEnemyDeath(world, child, {
        damageMeta: makeUnknownDamageMeta(`splitter_stage2_${child}`),
        source: "OTHER",
      })).toBe(true);
      expect(world.eAlive.length).toBe(totalEnemiesBeforeStage2Deaths);
    }

    expect(aliveSplittersAtStage(world, 2)).toHaveLength(0);
  });
});
