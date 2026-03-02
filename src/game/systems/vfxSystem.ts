import type { World } from "../../engine/world/world";
import type { GameEvent } from "../events";
import { VFX_CLIPS, VFX_CLIP_INDEX } from "../content/vfxRegistry";
import { getEnemyWorld } from "../coords/worldViews";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export function vfxSystem(w: World, dt: number): void {
  const events = w.events as GameEvent[];

  // 1) Spawn from VFX events
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type !== "VFX") continue;

    const clipIndex = VFX_CLIP_INDEX[ev.id] ?? -1;
    if (clipIndex < 0) continue;
    const clip = VFX_CLIPS[clipIndex];
    const isLoop = ev.loop ?? clip.loop;
    const ttl = isLoop ? Infinity : clip.spriteIds.length / clip.fps;

    w.vfxAlive.push(true);
    w.vfxX.push(ev.x);
    w.vfxY.push(ev.y);
    w.vfxRadius.push(ev.radius ?? 0);
    w.vfxElapsed.push(0);
    w.vfxTtl.push(ttl);
    w.vfxClipId.push(clipIndex);
    w.vfxLoop.push(isLoop);
    w.vfxFollowEnemy.push(ev.followEnemyIndex ?? -1);
    w.vfxOffsetYPx.push(ev.offsetYPx ?? 0);
    w.vfxScale.push(ev.scale ?? 1);
  }

  // 2) Handle VFX_STOP_FOLLOW — kill VFX matching clipId + followEnemyIndex
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type !== "VFX_STOP_FOLLOW") continue;
    const clipIndex = VFX_CLIP_INDEX[ev.id] ?? -1;
    for (let j = 0; j < w.vfxAlive.length; j++) {
      if (!w.vfxAlive[j]) continue;
      if (w.vfxClipId[j] === clipIndex && w.vfxFollowEnemy[j] === ev.enemyIndex) {
        w.vfxAlive[j] = false;
      }
    }
  }

  // 3) Follow alive enemies, kill VFX if enemy died
  for (let i = 0; i < w.vfxAlive.length; i++) {
    if (!w.vfxAlive[i]) continue;
    const followIdx = w.vfxFollowEnemy[i];
    if (followIdx < 0) continue;

    if (!w.eAlive[followIdx]) {
      // Enemy dead — kill the VFX
      w.vfxAlive[i] = false;
      continue;
    }

    const ew = getEnemyWorld(w, followIdx, KENNEY_TILE_WORLD);
    w.vfxX[i] = ew.wx;
    w.vfxY[i] = ew.wy;
  }

  // 4) Tick + expire (loop VFX never expire via TTL)
  for (let i = 0; i < w.vfxAlive.length; i++) {
    if (!w.vfxAlive[i]) continue;
    w.vfxElapsed[i] += dt;
    if (!w.vfxLoop[i] && w.vfxElapsed[i] >= w.vfxTtl[i]) {
      w.vfxAlive[i] = false;
    }
  }
}
