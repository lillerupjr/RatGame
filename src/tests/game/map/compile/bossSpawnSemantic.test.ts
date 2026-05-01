import { describe, expect, it } from "vitest";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";

describe("boss spawn semantic compilation", () => {
  it("exposes authored boss_spawn as dedicated semantic map data", () => {
    const compiled = compileKenneyMapFromTable({
      id: "BOSS_SPAWN_TEST",
      w: 16,
      h: 16,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [{ x: 8, y: 8, type: "boss_spawn" }],
    });

    expect(compiled.semanticData.bossSpawn).toEqual({ tx: 8, ty: 8 });
    expect(compiled.spawnTx).toBe(0);
    expect(compiled.spawnTy).toBe(0);
  });

  it("fails clearly when a map authors duplicate boss_spawn stamps", () => {
    expect(() => compileKenneyMapFromTable({
      id: "BOSS_SPAWN_DUPLICATE_TEST",
      w: 16,
      h: 16,
      cells: [{ x: 0, y: 0, type: "spawn", z: 0 }],
      stamps: [
        { x: 8, y: 8, type: "boss_spawn" },
        { x: 9, y: 9, type: "boss_spawn" },
      ],
    })).toThrow(/duplicate boss_spawn/i);
  });
});
