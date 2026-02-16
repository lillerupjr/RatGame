import type { World } from "../../../engine/world/world";

/** Updates neutral animated mobs (no movement/AI). */
export function neutralAnimatedMobsSystem(w: World, dt: number): void {
  for (let i = 0; i < w.neutralMobs.length; i++) {
    const mob = w.neutralMobs[i];
    const frameCount = mob.spriteFrames.length;
    if (frameCount <= 0) continue;

    const frameDuration = 1 / Math.max(1, mob.anim.fps);
    mob.anim.elapsed += dt;

    let advanced = false;
    while (mob.anim.elapsed >= frameDuration) {
      mob.anim.elapsed -= frameDuration;
      mob.anim.frameIndex += 1;
      advanced = true;
    }

    if (!advanced) continue;

    if (mob.anim.loop) {
      mob.anim.frameIndex %= frameCount;
    } else if (mob.anim.frameIndex >= frameCount) {
      mob.anim.frameIndex = frameCount - 1;
    }

    if (mob.debug.frameLogsRemaining > 0) {
      mob.debug.frameLogsRemaining -= 1;
    }
  }
}
