import { describe, expect, test } from "vitest";
import { createWorld } from "../../engine/world/world";
import { stageDocks } from "../content/stages";
import { applyRelic } from "../systems/progression/relics";

describe("PASS_LIFE_TO_DAMAGE_2P", () => {
  test("baseline scaling at 100 max life", () => {
    const world = createWorld({ seed: 201, stage: stageDocks });
    world.playerHpMax = 100;
    world.dmgMult = 1;

    applyRelic(world, "PASS_LIFE_TO_DAMAGE_2P");

    expect(world.dmgMult).toBeCloseTo(1.02, 6);
  });

  test("higher scaling at 500 max life", () => {
    const world = createWorld({ seed: 202, stage: stageDocks });
    world.playerHpMax = 500;
    world.dmgMult = 1;

    applyRelic(world, "PASS_LIFE_TO_DAMAGE_2P");

    expect(world.dmgMult).toBeCloseTo(1.1, 6);
  });

  test("relic is deduped and does not stack", () => {
    const world = createWorld({ seed: 203, stage: stageDocks });
    world.playerHpMax = 500;

    applyRelic(world, "PASS_LIFE_TO_DAMAGE_2P");
    const once = world.dmgMult;
    applyRelic(world, "PASS_LIFE_TO_DAMAGE_2P");

    expect(world.dmgMult).toBeCloseTo(once, 6);
    expect(world.relics).toEqual(["PASS_LIFE_TO_DAMAGE_2P"]);
  });
});
