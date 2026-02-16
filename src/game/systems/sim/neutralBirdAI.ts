import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPlayerWorld } from "../../coords/worldViews";
import { getUserSettings } from "../../../userSettings";
import { getPigeonFramesForClip } from "../../../engine/render/sprites/neutralSprites";

type BirdState = "IDLE" | "WALK_AWAY" | "TAKEOFF" | "FLY_AWAY" | "LAND";

function normalizeOrFallback(dx: number, dy: number, epsilon: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= epsilon) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function setBirdState(w: World, index: number, state: BirdState): void {
  const bird = w.neutralMobs[index];
  if (bird.behavior.state === state) return;
  bird.behavior.state = state;
  bird.behavior.t = 0;
  bird.anim.clip = state;
  bird.spriteFrames = getPigeonFramesForClip(state);
  bird.anim.frameIndex = 0;
  bird.anim.elapsed = 0;
}

/** Neutral bird AI v1: IDLE -> WALK_AWAY -> TAKEOFF -> FLY_AWAY -> LAND -> IDLE */
export function neutralBirdAISystem(w: World, dt: number): void {
  const player = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const debug = getUserSettings().debug.neutralBirdAI;

  for (let i = 0; i < w.neutralMobs.length; i++) {
    const bird = w.neutralMobs[i];
    if (bird.kind !== "PIGEON") continue;

    const b = bird.behavior;
    const p = bird.params;

    const dx = bird.pos.wx - player.wx;
    const dy = bird.pos.wy - player.wy;
    const dist2Tiles = (dx * dx + dy * dy) / (KENNEY_TILE_WORLD * KENNEY_TILE_WORLD);
    b.lastPlayerDist2 = dist2Tiles;
    b.t += dt;
    b.dirLockT = Math.max(0, b.dirLockT - dt);

    if (!debug.enabled) {
      setBirdState(w, i, "IDLE");
      bird.pos.wzOffset = 0;
      bird.render.flipX = false;
      continue;
    }

    if (debug.forceState !== "NONE") {
      setBirdState(w, i, debug.forceState);
    }

    if (!debug.disableTransitions && debug.forceState === "NONE") {
      if (b.state === "IDLE") {
        if (dist2Tiles <= p.takeoffTriggerTiles * p.takeoffTriggerTiles) {
          setBirdState(w, i, "TAKEOFF");
        } else if (dist2Tiles <= p.walkTriggerTiles * p.walkTriggerTiles) {
          setBirdState(w, i, "WALK_AWAY");
        }
      } else if (b.state === "WALK_AWAY") {
        if (dist2Tiles <= p.takeoffTriggerTiles * p.takeoffTriggerTiles) {
          setBirdState(w, i, "TAKEOFF");
        }
      } else if (b.state === "TAKEOFF") {
        if (b.t >= p.takeoffTimeSec) {
          setBirdState(w, i, "FLY_AWAY");
        }
      } else if (b.state === "LAND") {
        if (b.t >= p.landTimeSec) {
          setBirdState(w, i, "IDLE");
        }
      }
    }

    if (b.state === "WALK_AWAY") {
      const dir = normalizeOrFallback(dx, dy, p.epsilon);
      b.dirX = dir.x;
      b.dirY = dir.y;
      const speedWorld = p.walkSpeedTilesPerSec * KENNEY_TILE_WORLD;
      bird.pos.wx += b.dirX * speedWorld * dt;
      bird.pos.wy += b.dirY * speedWorld * dt;
      bird.pos.wzOffset = 0;
    } else if (b.state === "TAKEOFF") {
      const risePerSec = p.flyHeight / Math.max(p.epsilon, p.takeoffTimeSec);
      bird.pos.wzOffset = Math.min(p.flyHeight, bird.pos.wzOffset + risePerSec * dt);
    } else if (b.state === "FLY_AWAY") {
      if (b.dirLockT <= p.epsilon) {
        const dir = normalizeOrFallback(dx, dy, p.epsilon);
        b.dirX = dir.x;
        b.dirY = dir.y;
        b.dirLockT = p.dirLockSec;
      }

      const speedWorld = p.flySpeedTilesPerSec * KENNEY_TILE_WORLD;
      bird.pos.wx += b.dirX * speedWorld * dt;
      bird.pos.wy += b.dirY * speedWorld * dt;
      bird.pos.wzOffset = p.flyHeight;

      const dx2 = bird.pos.wx - player.wx;
      const dy2 = bird.pos.wy - player.wy;
      const dist2TilesAfterMove = (dx2 * dx2 + dy2 * dy2) / (KENNEY_TILE_WORLD * KENNEY_TILE_WORLD);
      b.lastPlayerDist2 = dist2TilesAfterMove;

      if (!debug.disableTransitions && debug.forceState === "NONE") {
        const safe2 = p.safeDistanceTiles * p.safeDistanceTiles;
        if (dist2TilesAfterMove >= safe2 || b.t >= p.maxFlyTimeSec) {
          setBirdState(w, i, "LAND");
        }
      }
    } else if (b.state === "LAND") {
      const fallPerSec = p.flyHeight / Math.max(p.epsilon, p.landTimeSec);
      bird.pos.wzOffset = Math.max(0, bird.pos.wzOffset - fallPerSec * dt);
    } else {
      bird.pos.wzOffset = 0;
    }

    bird.render.flipX = b.state === "WALK_AWAY" || b.state === "FLY_AWAY" ? b.dirX < 0 : false;
  }
}
