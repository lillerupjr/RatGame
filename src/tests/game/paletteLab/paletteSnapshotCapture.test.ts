import { describe, expect, test } from "vitest";
import { capturePaletteSnapshotDraft } from "../../../game/paletteLab/snapshotCapture";

function makeWorld(overrides: Record<string, unknown> = {}) {
  return {
    floorIndex: 2,
    runSeed: 1337,
    stageId: "SEWERS",
    currentFloorIntent: {
      mapId: "Avenue",
      zoneId: "SEWERS",
      variantSeed: 4242,
    },
    camera: {
      posX: 101.25,
      posY: 77.5,
    },
    cameraSafeRect: {
      zoom: 2.5,
    },
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
    eAlive: [true, false, true],
    eType: [1, 2, 3],
    egxi: [14, 0, 9],
    egyi: [17, 0, 11],
    egox: [0.1, 0, 0.4],
    egoy: [0.2, 0, 0.6],
    eHp: [25, 0, 10],
    eFaceX: [1, 0, -1],
    eFaceY: [0, 0, 1],
    ezVisual: [1, 0, 2],
    ezLogical: [1, 0, 2],
    lighting: {
      darknessAlpha: 0.65,
      ambientTint: "#334455",
      ambientTintStrength: 0.2,
    },
    ...overrides,
  } as any;
}

describe("palette snapshot capture", () => {
  test("captures metadata, scene context, camera state, and minimal world state", () => {
    const snapshot = capturePaletteSnapshotDraft(makeWorld(), {
      nowMs: 1710354720000,
      idFactory: () => "snap-fixed-id",
    });

    expect(snapshot.metadata.id).toBe("snap-fixed-id");
    expect(snapshot.metadata.version).toBe(1);
    expect(snapshot.metadata.createdAt).toBe(1710354720000);
    expect(snapshot.metadata.name).toMatch(/^Avenue - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    expect(snapshot.sceneContext).toEqual({
      mapId: "Avenue",
      biomeId: "SEWERS",
      seed: 4242,
    });

    expect(snapshot.cameraState).toEqual({
      cameraX: 101.25,
      cameraY: 77.5,
      cameraZoom: 2.5,
    });

    expect(snapshot.worldState.player).toEqual({
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
    });

    expect(snapshot.worldState.enemies).toEqual([
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
      {
        id: 2,
        type: 3,
        pgxi: 9,
        pgyi: 11,
        pgox: 0.4,
        pgoy: 0.6,
        hp: 10,
        faceX: -1,
        faceY: 1,
        zVisual: 2,
        zLogical: 2,
      },
    ]);

    expect(snapshot.worldState.lighting).toEqual({
      darknessAlpha: 0.65,
      ambientTint: "#334455",
      ambientTintStrength: 0.2,
    });
  });

  test("auto-generated names humanize map ids for user-visible format", () => {
    const snapshot = capturePaletteSnapshotDraft(
      makeWorld({
        currentFloorIntent: {
          mapId: "china_town",
          zoneId: "SEWERS",
          variantSeed: 123,
        },
      }),
      {
        nowMs: 1710354720000,
        idFactory: () => "snap-humanized",
      },
    );

    expect(snapshot.metadata.name).toMatch(/^China Town - \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  test("uses provided name and safe fallbacks", () => {
    const snapshot = capturePaletteSnapshotDraft(
      makeWorld({
        currentFloorIntent: null,
        stageId: undefined,
        camera: {},
        cameraSafeRect: {},
        lighting: {},
      }),
      {
        nowMs: 1710354720000,
        name: "  My Snapshot  ",
        idFactory: () => "manual-id",
      },
    );

    expect(snapshot.metadata.name).toBe("My Snapshot");
    expect(snapshot.metadata.id).toBe("manual-id");
    expect(snapshot.sceneContext.mapId).toBe("floor_2");
    expect(snapshot.sceneContext.seed).toBe(1337);
    expect(snapshot.cameraState.cameraZoom).toBe(1);
    expect(snapshot.worldState.lighting.darknessAlpha).toBe(0.5);
  });

  test("world state stays visual-only and does not include persistence payloads", () => {
    const snapshot = capturePaletteSnapshotDraft(makeWorld());
    expect(Object.keys(snapshot.worldState).sort()).toEqual(["enemies", "lighting", "player"]);
  });
});
