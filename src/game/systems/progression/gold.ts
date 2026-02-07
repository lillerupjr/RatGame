import type { World } from "../../../engine/world/world";

/** Award gold from centralized kill events. */
export function goldSystem(world: World): void {
  for (let i = 0; i < world.events.length; i++) {
    const ev = world.events[i];
    if (ev.type !== "ENEMY_KILLED") continue;
    world.gold += 1;
  }
}
