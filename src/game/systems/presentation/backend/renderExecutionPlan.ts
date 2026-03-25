import type { RenderCommand, RenderFrame } from "../contracts/renderCommands";
import { resolveRenderZBand } from "../worldRenderOrdering";

export type RenderExecutionPlan = {
  world: RenderCommand[];
  screen: RenderCommand[];
};

export function buildRenderExecutionPlan(
  frame: RenderFrame,
  rampRoadTiles: ReadonlySet<string>,
): RenderExecutionPlan {
  const groundSlice = frame.ground;
  const worldSlice = frame.world.filter((command) => (command.data.stage ?? "slice") === "slice");
  const worldBand = frame.world.filter((command) => command.data.stage === "band");
  const worldTail = frame.world.filter((command) => command.data.stage === "tail");
  const zBands = new Set<number>();

  for (let i = 0; i < groundSlice.length; i++) {
    zBands.add(resolveRenderZBand(groundSlice[i].key, rampRoadTiles));
  }
  for (let i = 0; i < worldSlice.length; i++) {
    zBands.add(resolveRenderZBand(worldSlice[i].key, rampRoadTiles));
  }
  for (let i = 0; i < worldBand.length; i++) {
    const zBand = worldBand[i].data.zBand;
    if (typeof zBand === "number") zBands.add(zBand);
  }

  const orderedWorld: RenderCommand[] = [];
  const zBandKeys = Array.from(zBands);
  zBandKeys.sort((a, b) => a - b);
  const firstZBand = zBandKeys[0];

  for (let zi = 0; zi < zBandKeys.length; zi++) {
    const zBand = zBandKeys[zi];
    for (let i = 0; i < groundSlice.length; i++) {
      if (resolveRenderZBand(groundSlice[i].key, rampRoadTiles) !== zBand) continue;
      orderedWorld.push(groundSlice[i]);
    }
    for (let i = 0; i < worldBand.length; i++) {
      const targetBand = worldBand[i].data.zBand;
      if (targetBand === "FIRST" && zBand !== firstZBand) continue;
      if (typeof targetBand === "number" && targetBand !== zBand) continue;
      orderedWorld.push(worldBand[i]);
    }
    for (let i = 0; i < worldSlice.length; i++) {
      if (resolveRenderZBand(worldSlice[i].key, rampRoadTiles) !== zBand) continue;
      orderedWorld.push(worldSlice[i]);
    }
  }

  for (let i = 0; i < worldTail.length; i++) orderedWorld.push(worldTail[i]);

  return {
    world: orderedWorld,
    screen: [...frame.screen],
  };
}
