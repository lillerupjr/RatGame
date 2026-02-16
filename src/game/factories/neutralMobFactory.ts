import type { World } from "../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";
import { gridToWorld } from "../coords/grid";
import { gridAtPlayer } from "../../engine/world/world";
import { getPigeonFramesForClip } from "../../engine/render/sprites/neutralSprites";

const DEFAULT_BIRD_PARAMS = {
  walkTriggerTiles: 3.0,
  safeDistanceTiles: 2.0,
  targetMinDistanceTiles: 3,
  targetMaxDistanceTiles: 7,
  targetAngleJitterDeg: 20,
  flySpeedTilesPerSec: 3.0,
  targetReachedThresholdTiles: 0.2,
  flyHeight: 8.0,
  takeoffTimeSec: 0.25,
  landTimeSec: 0.25,
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
      stateTimerSec: 0,
      targetTileX: gx,
      targetTileY: gy,
      lastPlayerDist2: Number.POSITIVE_INFINITY,
      lastTargetDist2: Number.POSITIVE_INFINITY,
    },
    params: { ...DEFAULT_BIRD_PARAMS },
    spriteFrames,
    render: {
      anchorX: 0.5,
      anchorY: 0.72,
      scale: 0.8,
      flipX: false,
      screenDir: "E",
    },
    debug: {
      frameLogsRemaining: 6,
      renderLogged: false,
    },
  });

}

export function spawnMilestonePigeonNearPlayer(w: World): void {
  const pg = gridAtPlayer(w);
  const offsets: Array<{ dx: number; dy: number }> = [
    { dx: 4, dy: 2 },
    { dx: 5, dy: 2 },
    { dx: 2, dy: 4 },
    { dx: -2, dy: 4 },
    { dx: -4, dy: 2 },
    { dx: -5, dy: 0 },
    { dx: -4, dy: -2 },
    { dx: 0, dy: -4 },
    { dx: 3, dy: -3 },
    { dx: 5, dy: -2 },
  ];

  for (let i = 0; i < offsets.length; i++) {
    const o = offsets[i];
    spawnNeutralPigeonAtGrid(w, pg.gx + o.dx, pg.gy + o.dy);
  }
}
