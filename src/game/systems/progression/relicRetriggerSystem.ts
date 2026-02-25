import type { World } from "../../../engine/world/world";
import { dispatchRelicTriggers } from "./relicTriggerSystem";

export function relicRetriggerSystem(world: World): void {
  const queue = world.relicRetriggerQueue;
  if (!Array.isArray(queue) || queue.length === 0) return;

  const pending = [];
  const due = [];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (world.time >= item.fireAt) due.push(item.event);
    else pending.push(item);
  }
  world.relicRetriggerQueue = pending;

  for (let i = 0; i < due.length; i++) {
    dispatchRelicTriggers(world, due[i]);
  }
}
