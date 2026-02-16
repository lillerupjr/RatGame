import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { gridToWorld } from "../coords/grid";
import { gridAtPlayer } from "../../engine/world/world";
import { getPigeonFramesForClip } from "../../engine/render/sprites/neutralSprites";

const DEFAULT_BIRD_PARAMS = {
  walkTriggerTiles: 2.0,
  takeoffTriggerTiles: 1.0,
  safeDistanceTiles: 4.0,
  walkSpeedTilesPerSec: 1.0,
  flySpeedTilesPerSec: 2.0,
  flyHeight: 8.0,
  takeoffTimeSec: 0.25,
  landTimeSec: 0.25,
  maxFlyTimeSec: 3.0,
  dirLockSec: 0.3,
  epsilon: 1e-4,
} as const;

export function spawnNeutralPigeonAtGrid(w: World, gx: number, gy: number): void {
  const pos = gridToWorld(gx, gy, KENNEY_TILE_WORLD);
  const spriteFrames = getPigeonFramesForClip("IDLE");

  w.neutralMobs.push({
    id: `pigeon_${gx}_${gy}_${w.neutralMobs.length}`,
    kind: "PIGEON",
    pos: { wx: pos.wx, wy: pos.wy, wzOffset: 0 },
    anim: {
      frameIndex: 0,
      fps: 11,
      loop: true,
      elapsed: 0,
      clip: "IDLE",
    },
    behavior: {
      state: "IDLE",
      t: 0,
      dirX: 1,
      dirY: 0,
      dirLockT: 0,
      lastPlayerDist2: Number.POSITIVE_INFINITY,
    },
    params: { ...DEFAULT_BIRD_PARAMS },
    spriteFrames,
    render: {
      anchorX: 0.5,
      anchorY: 0.72,
      scale: 1.2,
      flipX: false,
    },
    debug: {
      frameLogsRemaining: 6,
      renderLogged: false,
    },
  });

  console.log(`[neutralMobs] Spawned pigeon at tile (${gx}, ${gy})`);
}

export function spawnMilestonePigeonNearPlayer(w: World): void {
  const pg = gridAtPlayer(w);
  const offsets: Array<{ dx: number; dy: number }> = [
    { dx: 2, dy: 1 },
    { dx: 3, dy: 1 },
    { dx: 1, dy: 2 },
    { dx: -1, dy: 2 },
    { dx: -2, dy: 1 },
    { dx: -3, dy: 0 },
    { dx: -2, dy: -1 },
    { dx: 0, dy: -2 },
    { dx: 2, dy: -2 },
    { dx: 3, dy: -1 },
  ];

  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[i];
    spawnNeutralPigeonAtGrid(w, pg.gx + o.dx, pg.gy + o.dy);
  }
}
