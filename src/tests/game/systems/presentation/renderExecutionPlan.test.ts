import { describe, expect, it } from "vitest";
import { buildRenderExecutionPlan } from "../../../../game/systems/presentation/backend/renderExecutionPlan";
import type { RenderCommand, RenderFrame } from "../../../../game/systems/presentation/contracts/renderCommands";
import { KindOrder, type RenderKey } from "../../../../game/systems/presentation/worldRenderOrdering";

function key(overrides: Partial<RenderKey>): RenderKey {
  return {
    slice: 0,
    within: 0,
    baseZ: 0,
    kindOrder: KindOrder.ENTITY,
    stableId: 0,
    ...overrides,
  };
}

type CommandOverrides = {
  pass?: RenderCommand["pass"];
  semanticFamily?: RenderCommand["semanticFamily"];
  finalForm?: RenderCommand["finalForm"];
  key?: Partial<RenderKey>;
  payload?: Record<string, unknown>;
};

function command(stableId: number, overrides: CommandOverrides = {}): RenderCommand {
  return {
    pass: overrides.pass ?? "WORLD",
    semanticFamily: overrides.semanticFamily ?? "worldSprite",
    finalForm: overrides.finalForm ?? "quad",
    key: key({ stableId, ...(overrides.key ?? {}) }),
    payload: {
      ...(overrides.payload ?? {}),
    },
  } as RenderCommand;
}

describe("buildRenderExecutionPlan", () => {
  it("preserves CPU-owned z-band order and band insertion", () => {
    const frame: RenderFrame = {
      ground: [
        command(1, { pass: "GROUND", key: { slice: 2, within: 1, baseZ: 2, kindOrder: KindOrder.FLOOR } }),
        command(2, { pass: "GROUND", key: { slice: 1, within: 1, baseZ: 1, kindOrder: KindOrder.FLOOR } }),
      ],
      world: [
        command(3, { key: { slice: 1, within: 1, baseZ: 1, kindOrder: KindOrder.ENTITY }, payload: { stage: "slice" } }),
        command(4, { key: { slice: 2, within: 1, baseZ: 2, kindOrder: KindOrder.ENTITY }, payload: { stage: "slice" } }),
        command(5, { payload: { stage: "band", zBand: "FIRST" } }),
        command(6, { payload: { stage: "band", zBand: 2 } }),
        command(7, { payload: { stage: "tail" } }),
      ],
      screen: [command(8, { pass: "SCREEN" })],
    };

    const plan = buildRenderExecutionPlan(frame, new Set<string>());

    expect(plan.world.map((entry) => entry.key.stableId)).toEqual([2, 5, 3, 1, 6, 4, 7]);
    expect(plan.screen.map((entry) => entry.key.stableId)).toEqual([8]);
  });
});
