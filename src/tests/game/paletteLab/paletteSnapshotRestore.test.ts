import { describe, expect, test } from "vitest";
import {
  buildPaletteSnapshotFloorIntent,
  extractPaletteSnapshotSceneRestoreState,
  normalizeSnapshotStageId,
} from "../../../game/paletteLab/snapshotRestore";

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    metadata: {
      id: "snap-1",
      version: 1,
      createdAt: 100,
      name: "Snapshot",
    },
    sceneContext: {
      mapId: "avenue",
      biomeId: "SEWERS",
      seed: 4242,
    },
    cameraState: {
      cameraX: 120.5,
      cameraY: 80.25,
      cameraZoom: 2.5,
    },
    worldState: {
      player: {
        pgxi: 12,
        pgyi: 18,
        pgox: 0.25,
        pgoy: 0.75,
        pz: 1,
        pzVisual: 1,
        pzLogical: 1,
        pvx: 3,
        pvy: -2,
        lastAimX: 0.5,
        lastAimY: -0.5,
      },
      enemies: [
        {
          id: 0,
          type: 1,
          pgxi: 14,
          pgyi: 17,
          pgox: 0.1,
          pgoy: 0.2,
          hp: 25,
          faceX: 1,
          faceY: 0,
          zVisual: 1,
          zLogical: 1,
        },
      ],
      lighting: {
        darknessAlpha: 0.65,
        ambientTint: "#334455",
        ambientTintStrength: 0.2,
      },
    },
    thumbnail: new Blob(["thumb"], { type: "image/jpeg" }),
    ...overrides,
  } as any;
}

describe("palette snapshot scene restore", () => {
  test("normalizes stage ids from biome labels with fallback", () => {
    expect(normalizeSnapshotStageId("docks", "SEWERS")).toBe("DOCKS");
    expect(normalizeSnapshotStageId("china_town", "DOCKS")).toBe("CHINATOWN");
    expect(normalizeSnapshotStageId("unknown", "SEWERS")).toBe("SEWERS");
  });

  test("builds floor intent from snapshot context", () => {
    const intent = buildPaletteSnapshotFloorIntent(makeRecord(), "DOCKS", 1337);
    expect(intent.nodeId).toBe("PALETTE_SNAPSHOT_snap-1");
    expect(intent.zoneId).toBe("SEWERS");
    expect(intent.mapId).toBe("avenue");
    expect(intent.variantSeed).toBe(4242);
    expect(intent.depth).toBe(1);
    expect(intent.floorIndex).toBe(0);
    expect(intent.archetype).toBe("SURVIVE");
  });

  test("extracts stable restore state for camera, player, enemies, and lighting", () => {
    const restored = extractPaletteSnapshotSceneRestoreState(makeRecord(), "DOCKS");
    expect(restored.stageId).toBe("SEWERS");
    expect(restored.mapId).toBe("avenue");
    expect(restored.cameraX).toBe(120.5);
    expect(restored.cameraY).toBe(80.25);
    expect(restored.cameraZoom).toBe(2.5);
    expect(restored.player.pgxi).toBe(12);
    expect(restored.player.pgyi).toBe(18);
    expect(restored.enemies).toHaveLength(1);
    expect(restored.enemies[0].type).toBe(1);
    expect(restored.lighting.darknessAlpha).toBe(0.65);
    expect(restored.lighting.ambientTint).toBe("#334455");
  });

  test("rejects forbidden persistence fields in world state", () => {
    const badRecord = makeRecord({
      worldState: {
        gameplaySave: { slot: 1 },
      },
    });
    expect(() => extractPaletteSnapshotSceneRestoreState(badRecord, "DOCKS"))
      .toThrow(/forbidden persistence fields/i);
  });
});
