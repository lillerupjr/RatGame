import { describe, expect, test } from "vitest";
import { createWorld } from "../../../../engine/world/world";
import { stageDocks } from "../../../../game/content/stages";
import {
  getStarterClusterJewelForCharacter,
  STARTER_CLUSTER_JEWELS,
  validateStarterClusterJewels,
} from "../../../../game/cluster_jewels/starterJewels";
import { getWorldClusterJewels, setWorldClusterJewels } from "../../../../game/cluster_jewels/state";
import { ensureStarterClusterJewelForCharacter } from "../../../../game/systems/progression/starterClusterJewels";

describe("starterClusterJewels", () => {
  test("starter mappings validate against the authored contract", () => {
    expect(() => validateStarterClusterJewels()).not.toThrow();
  });

  test("starting each character creates exactly one authored starter jewel", () => {
    const entries = Object.entries(STARTER_CLUSTER_JEWELS);
    for (let i = 0; i < entries.length; i++) {
      const [characterId, starterDef] = entries[i] as [keyof typeof STARTER_CLUSTER_JEWELS, (typeof STARTER_CLUSTER_JEWELS)[keyof typeof STARTER_CLUSTER_JEWELS]];
      const world = createWorld({ seed: i + 1, stage: stageDocks });

      ensureStarterClusterJewelForCharacter(world, characterId);
      ensureStarterClusterJewelForCharacter(world, characterId);

      expect(world.clusterJewels).toHaveLength(1);
      const starter = world.clusterJewels[0];
      expect(starter.id).toBe(starterDef.jewelId);
      expect(starter.category).toBe(starterDef.category);
      expect(starter.notableNodeId).toBe(starterDef.notableNodeId);
      expect(starter.source).toBe("starter");
      expect(starter.allocatedNodeIds).toEqual([]);
      expect(starter.smallNodeIds).toEqual(getStarterClusterJewelForCharacter(characterId)!.smallNodeIds);
    }
  });

  test("starter assignment upgrades existing non-starter metadata to the authored starter jewel", () => {
    const world = createWorld({ seed: 20, stage: stageDocks });
    const starter = getStarterClusterJewelForCharacter("HOBO")!;

    setWorldClusterJewels(world, [
      {
        ...starter,
        source: "debug",
        allocatedNodeIds: [starter.notableNodeId],
      },
    ]);
    ensureStarterClusterJewelForCharacter(world, "HOBO");

    const instance = getWorldClusterJewels(world).find((it) => it.id === starter.id);
    expect(instance?.source).toBe("starter");
    expect(instance?.allocatedNodeIds).toEqual([starter.notableNodeId]);
  });

  test("starter assignment replaces conflicting starter jewel and preserves non-starters", () => {
    const world = createWorld({ seed: 21, stage: stageDocks });
    const hoboStarter = getStarterClusterJewelForCharacter("HOBO")!;
    const jackStarter = getStarterClusterJewelForCharacter("JACK")!;

    setWorldClusterJewels(world, [
      hoboStarter,
      {
        id: "generated-extra-jewel",
        category: "DAMAGE_OVER_TIME",
        smallNodeIds: [
          "DAMAGE_OVER_TIME_SMALL_DAMAGE_10",
          "DAMAGE_OVER_TIME_SMALL_DURATION_15",
          "DAMAGE_OVER_TIME_SMALL_TICK_RATE_5",
          "DAMAGE_OVER_TIME_SMALL_REDUCED_TAKEN_10",
        ],
        notableNodeId: "DAMAGE_OVER_TIME_NOTABLE_DAMAGE_30",
        source: "generated",
        allocatedNodeIds: [],
      },
    ]);

    ensureStarterClusterJewelForCharacter(world, "JACK");

    const starters = getWorldClusterJewels(world).filter((it) => it.source === "starter");
    expect(starters).toHaveLength(1);
    expect(starters[0].id).toBe(jackStarter.id);
    expect(world.clusterJewels.some((it) => it.id === "generated-extra-jewel")).toBe(true);
  });
});
