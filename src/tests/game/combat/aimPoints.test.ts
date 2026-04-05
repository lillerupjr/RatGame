import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { worldDeltaToScreen } from "../../../engine/math/iso";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { stageDocks } from "../../../game/content/stages";
import { EnemyId, spawnEnemyGrid } from "../../../game/factories/enemyFactory";
import { getEnemyWorld, getPlayerWorld } from "../../../game/coords/worldViews";
import { getEnemyAimDebugInfo, getEnemyAimWorld, getPlayerAimWorld } from "../../../game/combat/aimPoints";

describe("aimPoints screen-axis offsets", () => {
  test("player aim uses pure screen-up offset by default", () => {
    const w = createWorld({ seed: 101, stage: stageDocks });
    const playerWorld = getPlayerWorld(w, KENNEY_TILE_WORLD);
    const playerAim = getPlayerAimWorld(w);
    const projected = worldDeltaToScreen(playerAim.x - playerWorld.wx, playerAim.y - playerWorld.wy);

    expect(projected.dx).toBeCloseTo(0, 6);
    expect(projected.dy).toBeCloseTo(-12, 6);
  });

  test("enemy aim conversion is deterministic and matches effective screen offset", () => {
    const w = createWorld({ seed: 202, stage: stageDocks });
    const enemyIndex = spawnEnemyGrid(w, EnemyId.MINION, 8, 8);
    const infoA = getEnemyAimDebugInfo(w, enemyIndex);
    const infoB = getEnemyAimDebugInfo(w, enemyIndex);

    expect(infoA.skinScreenOffset).toEqual({ x: 0, y: 0 });
    expect(infoA.effectiveScreenOffset).toEqual(infoB.effectiveScreenOffset);
    expect(infoA.effectiveWorldDelta).toEqual(infoB.effectiveWorldDelta);

    const projected = worldDeltaToScreen(infoA.effectiveWorldDelta.dx, infoA.effectiveWorldDelta.dy);
    expect(projected.dx).toBeCloseTo(infoA.effectiveScreenOffset.x, 6);
    expect(projected.dy).toBeCloseTo(infoA.effectiveScreenOffset.y, 6);

    const enemyWorld = getEnemyWorld(w, enemyIndex, KENNEY_TILE_WORLD);
    const enemyAim = getEnemyAimWorld(w, enemyIndex);
    expect(enemyAim.x - enemyWorld.wx).toBeCloseTo(infoA.effectiveWorldDelta.dx, 6);
    expect(enemyAim.y - enemyWorld.wy).toBeCloseTo(infoA.effectiveWorldDelta.dy, 6);
  });
});
