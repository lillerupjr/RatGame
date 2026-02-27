import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import { applyRelic } from "../../../../game/systems/progression/relics";
import { vendorSystem } from "../../../../game/systems/progression/vendorSystem";

describe("relic scaffold phase 0", () => {
  test("applyRelic stores relic id and dedupes", () => {
    const world = createWorld({ seed: 1, stage: stageDocks });
    expect(world.relics).toEqual([]);

    applyRelic(world, "PASS_MOVE_SPEED_20");
    applyRelic(world, "PASS_MOVE_SPEED_20");

    expect(world.relics).toEqual(["PASS_MOVE_SPEED_20"]);
  });

  test("vendor RELIC purchase applies relic into world.relics", () => {
    const world = createWorld({ seed: 2, stage: stageDocks });
    world.run.runGold = 100;
    world.events.push({
      type: "VENDOR_PURCHASE",
      offer: { kind: "RELIC", id: "PASS_MOVE_SPEED_20", cost: 10 },
    });

    vendorSystem(world);

    expect(world.relics).toContain("PASS_MOVE_SPEED_20");
  });

  test("PASS_MOVE_SPEED_20 increases effective movement speed by 20%", () => {
    const world = createWorld({ seed: 3, stage: stageDocks });
    const baseline = world.pSpeed;

    applyRelic(world, "PASS_MOVE_SPEED_20");

    expect(world.pSpeed).toBeCloseTo(baseline * 1.2, 6);
  });

  test("vendor PASS_MOVE_SPEED_20 purchase applies speed bonus immediately", () => {
    const world = createWorld({ seed: 4, stage: stageDocks });
    world.run.runGold = 100;
    const baseline = world.pSpeed;
    world.events.push({
      type: "VENDOR_PURCHASE",
      offer: { kind: "RELIC", id: "PASS_MOVE_SPEED_20", cost: 10 },
    });

    vendorSystem(world);

    expect(world.relics).toContain("PASS_MOVE_SPEED_20");
    expect(world.pSpeed).toBeCloseTo(baseline * 1.2, 6);
  });

  test("PASS_DAMAGE_PERCENT_20 increases dmgMult by 20% and dedupes", () => {
    const world = createWorld({ seed: 5, stage: stageDocks });
    const baseline = world.dmgMult;

    applyRelic(world, "PASS_DAMAGE_PERCENT_20");
    expect(world.dmgMult).toBeCloseTo(baseline * 1.2, 6);
    expect(world.relics).toEqual(["PASS_DAMAGE_PERCENT_20"]);

    applyRelic(world, "PASS_DAMAGE_PERCENT_20");
    expect(world.dmgMult).toBeCloseTo(baseline * 1.2, 6);
    expect(world.relics).toEqual(["PASS_DAMAGE_PERCENT_20"]);
  });

  test("legacy relic ids are normalized on grant", () => {
    const world = createWorld({ seed: 6, stage: stageDocks });
    const legacyId = ["RELIC", "PASS", "MOVE", "SPEED"].join("_");
    applyRelic(world, legacyId);
    expect(world.relics).toEqual(["PASS_MOVE_SPEED_20"]);
  });

  test("SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40 applies more damage and less attack speed", () => {
    const world = createWorld({ seed: 7, stage: stageDocks });
    const baseDamageMult = world.dmgMult;
    const baseFireRateMult = world.fireRateMult;

    applyRelic(world, "SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40");

    expect(world.dmgMult).toBeCloseTo(baseDamageMult * 2.0, 6);
    expect(world.fireRateMult).toBeCloseTo(baseFireRateMult * 0.6, 6);
  });

  test("SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30 applies more attack speed and less damage", () => {
    const world = createWorld({ seed: 8, stage: stageDocks });
    const baseDamageMult = world.dmgMult;
    const baseFireRateMult = world.fireRateMult;

    applyRelic(world, "SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30");

    expect(world.dmgMult).toBeCloseTo(baseDamageMult * 0.7, 6);
    expect(world.fireRateMult).toBeCloseTo(baseFireRateMult * 1.5, 6);
  });

  test("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50 applies damage and max life reductions", () => {
    const world = createWorld({ seed: 9, stage: stageDocks });
    const baseDamageMult = world.dmgMult;
    const basePlayerHpMax = world.playerHpMax;

    applyRelic(world, "SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50");

    expect(world.dmgMult).toBeCloseTo(baseDamageMult * 3.0, 6);
    expect(world.playerHpMax).toBeCloseTo(basePlayerHpMax * 0.5, 6);
  });

  test("SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20 applies flat armor and less move speed", () => {
    const world = createWorld({ seed: 10, stage: stageDocks });
    const baseMaxArmor = world.maxArmor;
    const baseMoveSpeed = world.pSpeed;

    applyRelic(world, "SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20");

    expect(world.maxArmor).toBe(baseMaxArmor + 100);
    expect(world.pSpeed).toBeCloseTo(baseMoveSpeed * 0.8, 6);
  });
});
