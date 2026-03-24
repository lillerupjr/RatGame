import { describe, expect, it } from "vitest";
import { resolveStructureShadowRouting } from "../../../../game/systems/presentation/structureShadows/structureShadowVersionRouting";

describe("structureShadowVersionRouting", () => {
  it("treats v6SweepShadow as a V6 caster without enabling face-slice debug mode", () => {
    const routing = resolveStructureShadowRouting("v6SweepShadow");
    expect(routing.usesV1).toBe(false);
    expect(routing.usesV2).toBe(false);
    expect(routing.usesHybrid).toBe(false);
    expect(routing.usesV4).toBe(false);
    expect(routing.usesV5).toBe(false);
    expect(routing.usesV6).toBe(true);
    expect(routing.usesV6Debug).toBe(false);
  });

  it("keeps face-slice debug mode on the debug-only V6 path", () => {
    const routing = resolveStructureShadowRouting("v6FaceSliceDebug");
    expect(routing.usesV6).toBe(true);
    expect(routing.usesV6Debug).toBe(true);
  });
});
