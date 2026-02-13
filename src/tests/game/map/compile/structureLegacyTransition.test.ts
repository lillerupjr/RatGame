import { describe, expect, it } from "vitest";
import { getAuthoredMapDefByMapId } from "../../../../game/map/authored/authoredMapRegistry";
import { compileKenneyMapFromTable } from "../../../../game/map/compile/kenneyMapLoader";

describe("structure legacy transition", () => {
  it("keeps legacy sliced container assets working during runtime-slicing migration", () => {
    const def = getAuthoredMapDefByMapId("docks");
    expect(def).toBeTruthy();

    const compiled = compileKenneyMapFromTable(def!);

    const structureRoofs = compiled.overlays.filter(
      (o) => o.layerRole === "STRUCTURE"
        && o.spriteId.includes("structures/containers/")
        && o.spriteId.endsWith("/top"),
    );
    expect(structureRoofs.length).toBeGreaterThan(0);

    const wallPieces = Array.from(compiled.occludersByLayer.values())
      .flat()
      .filter((p) => p.kind === "WALL" && p.spriteId.includes("structures/containers/"));
    expect(wallPieces.length).toBeGreaterThan(0);

    const legacyWallSlices = wallPieces.filter((p) => /\/(s|e)_\d+$/.test(p.spriteId));
    expect(legacyWallSlices.length).toBeGreaterThan(0);
  });
});
