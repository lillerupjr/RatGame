import { describe, expect, test } from "vitest";
import { createWorld } from "../../../engine/world/world";
import { stageDocks } from "../../content/stages";
import { processCombatTextFromEvents } from "./collisions";
import { makeAilmentDotMeta, makeEnemyHitMeta, makeWeaponHitMeta } from "../../combat/damageMeta";

const DMG_COLOR_PHYSICAL = "#ffffff";
const DMG_COLOR_FIRE = "#ff9f3a";
const DMG_COLOR_CHAOS = "#b57bff";
const DMG_COLOR_POISON = "#6fe36f";
const DMG_COLOR_PLAYER = "#ff4b4b";

describe("processCombatTextFromEvents typed split", () => {
  test("emits one physical text when only physical damage is non-zero", () => {
    const w = createWorld({ seed: 1, stage: stageDocks });
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 10,
      dmgPhys: 10,
      dmgFire: 0,
      dmgChaos: 0,
      x: 100,
      y: 120,
      isCrit: false,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextValue).toEqual([10]);
    expect(w.floatTextColor).toEqual([DMG_COLOR_PHYSICAL]);
    expect(w.floatTextIsCrit).toEqual([false]);
    expect(w.floatTextIsPlayer).toEqual([false]);
  });

  test("emits vertical stacked text for physical, fire, chaos in deterministic order", () => {
    const w = createWorld({ seed: 2, stage: stageDocks });
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 22,
      dmgPhys: 8,
      dmgFire: 7,
      dmgChaos: 7,
      x: 50,
      y: 75,
      isCrit: false,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextValue).toEqual([8, 7, 7]);
    expect(w.floatTextColor).toEqual([DMG_COLOR_PHYSICAL, DMG_COLOR_FIRE, DMG_COLOR_CHAOS]);
    expect(w.floatTextY.length).toBe(3);
    expect(w.floatTextY[0]).toBeLessThan(w.floatTextY[1]);
    expect(w.floatTextY[1]).toBeLessThan(w.floatTextY[2]);
  });

  test("skips zero-value typed damage entries", () => {
    const w = createWorld({ seed: 3, stage: stageDocks });
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 5,
      dmgPhys: 0,
      dmgFire: 5,
      dmgChaos: 0,
      x: 40,
      y: 40,
      isCrit: false,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextValue).toEqual([5]);
    expect(w.floatTextColor).toEqual([DMG_COLOR_FIRE]);
  });

  test("applies crit flag and scaled sizing to all typed entries", () => {
    const w = createWorld({ seed: 4, stage: stageDocks });
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 18,
      dmgPhys: 6,
      dmgFire: 6,
      dmgChaos: 6,
      x: 40,
      y: 40,
      isCrit: true,
      critMult: 2,
      source: "PISTOL",
      damageMeta: makeWeaponHitMeta("PISTOL"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextIsCrit).toEqual([true, true, true]);
    expect(w.floatTextSize[0]).toBeGreaterThanOrEqual(12);
    expect(w.floatTextSize[1]).toBeGreaterThanOrEqual(12);
    expect(w.floatTextSize[2]).toBeGreaterThanOrEqual(12);
  });

  test("uses poison color for chaos damage on OTHER source", () => {
    const w = createWorld({ seed: 5, stage: stageDocks });
    w.events.push({
      type: "ENEMY_HIT",
      enemyIndex: 0,
      damage: 9,
      dmgPhys: 0,
      dmgFire: 0,
      dmgChaos: 9,
      x: 10,
      y: 10,
      isCrit: false,
      source: "OTHER",
      damageMeta: makeAilmentDotMeta("POISON"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextColor).toEqual([DMG_COLOR_POISON]);
  });

  test("PLAYER_HIT remains one red text entry", () => {
    const w = createWorld({ seed: 6, stage: stageDocks });
    w.events.push({
      type: "PLAYER_HIT",
      damage: 7,
      x: 11,
      y: 22,
      damageMeta: makeEnemyHitMeta("TEST_ENEMY", "TEST_ATTACK"),
    } as any);

    processCombatTextFromEvents(w, 0);

    expect(w.floatTextValue).toEqual([7]);
    expect(w.floatTextColor).toEqual([DMG_COLOR_PLAYER]);
    expect(w.floatTextIsPlayer).toEqual([true]);
  });
});
