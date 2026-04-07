import { describe, expect, it } from "vitest";
import { resolveStructureShadowRouting } from "../../../../game/systems/presentation/structureShadows/structureShadowVersionRouting";

describe("structureShadowVersionRouting", () => {
  it("always routes live rendering through the v6 structure shadow path", () => {
    const routing = resolveStructureShadowRouting();
    expect(routing.usesV6Sweep).toBe(true);
  });
});
