import { describe, expect, it } from "vitest";
import { resolveStructureShadowRouting } from "../../../../game/systems/presentation/structureShadows/structureShadowVersionRouting";

describe("structureShadowVersionRouting", () => {
  it("treats v6SweepShadow as a V6 caster without enabling face-slice debug mode", () => {
    const routing = resolveStructureShadowRouting("v6SweepShadow");
    expect(routing.usesV6Sweep).toBe(true);
    expect(routing.usesV6Debug).toBe(false);
  });

  it("keeps face-slice debug mode on the debug-only V6 path", () => {
    const routing = resolveStructureShadowRouting("v6FaceSliceDebug");
    expect(routing.usesV6Sweep).toBe(false);
    expect(routing.usesV6Debug).toBe(true);
  });
});
