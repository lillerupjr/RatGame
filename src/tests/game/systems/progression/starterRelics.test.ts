import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import {
  STARTER_RELIC_BY_CHARACTER,
  STARTER_RELIC_IDS,
  validateStarterRelics,
} from "../../../../game/content/starterRelics";
import {
  applyRelic,
  getWorldRelicInstances,
  removeRelic,
  setWorldRelicInstances,
} from "../../../../game/systems/progression/relics";
import { ensureStarterRelicForCharacter } from "../../../../game/systems/progression/starterRelics";

describe("starterRelics", () => {
  test("starter mapping validates against playable characters and relic defs", () => {
    expect(() => validateStarterRelics()).not.toThrow();
  });

  test("ensureStarterRelicForCharacter applies exactly once and marks starter relic locked", () => {
    const world = createWorld({ seed: 1, stage: stageDocks });
    const starterId = STARTER_RELIC_BY_CHARACTER.JACK;

    ensureStarterRelicForCharacter(world, "JACK");
    ensureStarterRelicForCharacter(world, "JACK");

    expect(world.relics.filter((id) => id === starterId)).toHaveLength(1);
    const instance = getWorldRelicInstances(world).find((it) => it.id === starterId);
    expect(instance).toBeTruthy();
    expect(instance?.source).toBe("starter");
    expect(instance?.isLocked).toBe(true);
  });

  test("ensureStarterRelicForCharacter upgrades existing non-starter metadata to starter lock", () => {
    const world = createWorld({ seed: 2, stage: stageDocks });
    const starterId = STARTER_RELIC_BY_CHARACTER.HOBO;

    applyRelic(world, starterId, { source: "debug", isLocked: false });
    ensureStarterRelicForCharacter(world, "HOBO");

    const instance = getWorldRelicInstances(world).find((it) => it.id === starterId);
    expect(instance?.source).toBe("starter");
    expect(instance?.isLocked).toBe(true);
  });

  test("ensureStarterRelicForCharacter replaces conflicting starter instance", () => {
    const world = createWorld({ seed: 3, stage: stageDocks });
    setWorldRelicInstances(world, [
      { id: STARTER_RELIC_IDS.LUCKY_CHAMBER, source: "starter", isLocked: true },
      { id: "PASS_MOVE_SPEED_20", source: "debug", isLocked: false },
    ]);

    const expectedStarter = STARTER_RELIC_BY_CHARACTER.JOEY;
    ensureStarterRelicForCharacter(world, "JOEY");

    const starterInstances = getWorldRelicInstances(world).filter((it) => it.source === "starter");
    expect(starterInstances).toHaveLength(1);
    expect(starterInstances[0].id).toBe(expectedStarter);
    expect(starterInstances[0].isLocked).toBe(true);
    expect(world.relics).toContain("PASS_MOVE_SPEED_20");
  });

  test("starter relic removal is rejected", () => {
    const world = createWorld({ seed: 4, stage: stageDocks });
    const starterId = ensureStarterRelicForCharacter(world, "TOMMY");
    expect(starterId).toBeTruthy();

    const result = removeRelic(world, starterId!);
    expect(result).toEqual({ removed: false, reason: "LOCKED" });
    expect(world.relics).toContain(starterId!);
  });
});
