import { describe, expect, test } from "vitest";
import {
  AUTHORED_MAP_DEFS,
  getAuthoredMapDefByMapId,
  withoutStructureStamps,
} from "../../../game/map/authored/authoredMapRegistry";

describe("withoutStructureStamps", () => {
  test("removes every building stamp and keeps the rest", () => {
    const docks = getAuthoredMapDefByMapId("docks");
    expect(docks).toBeDefined();
    const before = docks!.stamps ?? [];
    expect(before.some((stamp) => stamp.type === "building")).toBe(true);

    const stripped = withoutStructureStamps(docks!);

    expect(stripped.stamps?.some((stamp) => stamp.type === "building")).toBe(false);
    expect(stripped.stamps).toHaveLength(before.filter((stamp) => stamp.type !== "building").length);
    expect(docks!.stamps).toBe(before);
  });

  test("returns the same def when it has no building stamps", () => {
    const withoutBuildings = AUTHORED_MAP_DEFS.find((def) => !(def.stamps ?? []).some((stamp) => stamp.type === "building"));
    expect(withoutBuildings).toBeDefined();
    expect(withoutStructureStamps(withoutBuildings!)).toBe(withoutBuildings);
  });

  test("memoizes the stripped def", () => {
    const docks = getAuthoredMapDefByMapId("docks")!;
    expect(withoutStructureStamps(docks)).toBe(withoutStructureStamps(docks));
  });
});
