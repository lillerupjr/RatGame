import type { World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPlayerWorld } from "../../coords/worldViews";
import { getActiveMap } from "../../map/proceduralMapBridge";
import { getUserSettings, updateUserSettings } from "../../../userSettings";
import { getPigeonFramesForClipAndScreenDir } from "../../../engine/render/sprites/neutralSprites";
import { worldDeltaToScreen } from "../../../engine/math/iso";
import { dir8FromVector, type Dir8 } from "../../../engine/render/sprites/dir8";

type BirdState = "IDLE" | "TAKEOFF" | "FLY_TO_TARGET" | "LAND";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeOrFallback(dx: number, dy: number, epsilon: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len <= epsilon) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function normalize3OrFallback(
  dx: number,
  dy: number,
  dz: number,
  epsilon: number,
): { x: number; y: number; z: number } {
  const len = Math.hypot(dx, dy, dz);
  if (len <= epsilon) return { x: 1, y: 0, z: 0 };
  return { x: dx / len, y: dy / len, z: dz / len };
}

function setBirdState(w: World, index: number, state: BirdState): void {
  const bird = w.neutralMobs[index];
  if (bird.behavior.state === state) return;
  bird.behavior.state = state;
  bird.behavior.stateTimerSec = 0;
  bird.anim.clip = state;
  bird.spriteFrames = getPigeonFramesForClipAndScreenDir(state, bird.render.screenDir);
  bird.anim.frameIndex = 0;
  bird.anim.elapsed = 0;
}

function setBirdScreenDir(w: World, index: number, worldDx: number, worldDy: number): void {
  const bird = w.neutralMobs[index];
  if (Math.hypot(worldDx, worldDy) <= bird.params.epsilon) return;
  const sd = worldDeltaToScreen(worldDx, worldDy);
  // dir8FromVector assumes +Y is up; screen-space +Y is down, so invert Y.
  const dir = dir8FromVector(sd.dx, -sd.dy) as Dir8;
  if (bird.render.screenDir === dir) return;
  bird.render.screenDir = dir;
  bird.spriteFrames = getPigeonFramesForClipAndScreenDir(bird.anim.clip, dir);
  bird.anim.frameIndex = 0;
  bird.anim.elapsed = 0;
}

function pickTargetTile(w: World, index: number, playerWx: number, playerWy: number): void {
  const bird = w.neutralMobs[index];
  const p = bird.params;
  const eps = p.epsilon;
  const tileWorld = KENNEY_TILE_WORLD;

  const away = normalizeOrFallback(bird.pos.wx - playerWx, bird.pos.wy - playerWy, eps);
  const jitterDeg = w.rng.range(-p.targetAngleJitterDeg, p.targetAngleJitterDeg);
  const jitterRad = (jitterDeg * Math.PI) / 180;
  const c = Math.cos(jitterRad);
  const s = Math.sin(jitterRad);
  const dirX = away.x * c - away.y * s;
  const dirY = away.x * s + away.y * c;
  const dir = normalizeOrFallback(dirX, dirY, eps);

  const distTiles = w.rng.int(p.targetMinDistanceTiles, p.targetMaxDistanceTiles);
  const birdTileX = Math.round(bird.pos.wx / tileWorld - 0.5);
  const birdTileY = Math.round(bird.pos.wy / tileWorld - 0.5);

  let targetTileX = Math.round(birdTileX + dir.x * distTiles);
  let targetTileY = Math.round(birdTileY + dir.y * distTiles);

  const active = getActiveMap();
  if (active) {
    const minTx = active.originTx;
    const minTy = active.originTy;
    const maxTx = active.originTx + active.width - 1;
    const maxTy = active.originTy + active.height - 1;
    targetTileX = clamp(targetTileX, minTx, maxTx);
    targetTileY = clamp(targetTileY, minTy, maxTy);
  }

  bird.behavior.targetTileX = targetTileX;
  bird.behavior.targetTileY = targetTileY;
}

/** Neutral bird AI v1.1: IDLE -> TAKEOFF -> FLY_TO_TARGET -> LAND -> IDLE */
export function neutralBirdAISystem(w: World, dt: number): void {
  const player = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const settings = getUserSettings();
  const debug = {
    enabled: settings.debug.neutralBirdAI?.enabled ?? false,
    forceState: settings.debug.neutralBirdAI?.forceState ?? "NONE",
    disableTransitions: settings.debug.neutralBirdAI?.disableTransitions ?? false,
    drawDebug: settings.debug.neutralBirdAI?.drawDebug ?? true,
    debugRepickTarget: settings.debug.neutralBirdAI?.debugRepickTarget ?? false,
  };

  const shouldRepickAllTargets = debug.debugRepickTarget;

  for (let i = 0; i < w.neutralMobs.length; i++) {
    const bird = w.neutralMobs[i];
    if (bird.kind !== "PIGEON") continue;

    const b = bird.behavior;
    const p = bird.params;

    const dxPlayer = bird.pos.wx - player.wx;
    const dyPlayer = bird.pos.wy - player.wy;
    const dPlayer2Tiles =
      (dxPlayer * dxPlayer + dyPlayer * dyPlayer) / (KENNEY_TILE_WORLD * KENNEY_TILE_WORLD);
    b.lastPlayerDist2 = dPlayer2Tiles;
    b.stateTimerSec += dt;

    const targetWx = (b.targetTileX + 0.5) * KENNEY_TILE_WORLD;
    const targetWy = (b.targetTileY + 0.5) * KENNEY_TILE_WORLD;
    const dxTarget = targetWx - bird.pos.wx;
    const dyTarget = targetWy - bird.pos.wy;
    const dTarget2Tiles =
      (dxTarget * dxTarget + dyTarget * dyTarget) / (KENNEY_TILE_WORLD * KENNEY_TILE_WORLD);
    b.lastTargetDist2 = dTarget2Tiles;

    if (shouldRepickAllTargets) pickTargetTile(w, i, player.wx, player.wy);

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
        if (dPlayer2Tiles <= p.walkTriggerTiles * p.walkTriggerTiles) {
          setBirdState(w, i, "TAKEOFF");
          pickTargetTile(w, i, player.wx, player.wy);
        }
      } else if (b.state === "TAKEOFF") {
        if (b.stateTimerSec >= p.takeoffTimeSec) {
          setBirdState(w, i, "FLY_TO_TARGET");
        }
      } else if (b.state === "LAND") {
        if (b.stateTimerSec >= p.landTimeSec) {
          setBirdState(w, i, "IDLE");
        }
      }
    }

    if (b.state === "TAKEOFF") {
      const dxTargetTiles = dxTarget / KENNEY_TILE_WORLD;
      const dyTargetTiles = dyTarget / KENNEY_TILE_WORLD;
      const dzTarget = p.flyHeight - bird.pos.wzOffset;
      const dir3 = normalize3OrFallback(dxTargetTiles, dyTargetTiles, dzTarget, p.epsilon);
      const stepTiles = p.flySpeedTilesPerSec * dt;
      setBirdScreenDir(w, i, dxTargetTiles, dyTargetTiles);
      bird.pos.wx += dir3.x * stepTiles * KENNEY_TILE_WORLD;
      bird.pos.wy += dir3.y * stepTiles * KENNEY_TILE_WORLD;
      bird.pos.wzOffset = clamp(bird.pos.wzOffset + dir3.z * stepTiles, 0, p.flyHeight);
      bird.render.flipX = false;
      continue;
    }

    if (b.state === "FLY_TO_TARGET") {
      const dxTargetTiles = dxTarget / KENNEY_TILE_WORLD;
      const dyTargetTiles = dyTarget / KENNEY_TILE_WORLD;
      const dzTarget = p.flyHeight - bird.pos.wzOffset;
      const dir3 = normalize3OrFallback(dxTargetTiles, dyTargetTiles, dzTarget, p.epsilon);
      const stepTiles = p.flySpeedTilesPerSec * dt;
      setBirdScreenDir(w, i, dxTargetTiles, dyTargetTiles);
      bird.pos.wx += dir3.x * stepTiles * KENNEY_TILE_WORLD;
      bird.pos.wy += dir3.y * stepTiles * KENNEY_TILE_WORLD;
      bird.pos.wzOffset = clamp(bird.pos.wzOffset + dir3.z * stepTiles, 0, p.flyHeight);
      bird.render.flipX = false;

      const targetWx2 = (b.targetTileX + 0.5) * KENNEY_TILE_WORLD;
      const targetWy2 = (b.targetTileY + 0.5) * KENNEY_TILE_WORLD;
      const dxTarget2 = targetWx2 - bird.pos.wx;
      const dyTarget2 = targetWy2 - bird.pos.wy;
      const dTarget2TilesAfterMove =
        (dxTarget2 * dxTarget2 + dyTarget2 * dyTarget2) / (KENNEY_TILE_WORLD * KENNEY_TILE_WORLD);
      b.lastTargetDist2 = dTarget2TilesAfterMove;

      if (!debug.disableTransitions && debug.forceState === "NONE") {
        const reached2 = p.targetReachedThresholdTiles * p.targetReachedThresholdTiles;
        if (dTarget2TilesAfterMove <= reached2) {
          const safe2 = p.safeDistanceTiles * p.safeDistanceTiles;
          if (dPlayer2Tiles > safe2) {
            setBirdState(w, i, "LAND");
          } else {
            pickTargetTile(w, i, player.wx, player.wy);
          }
        }
      }
      continue;
    }

    if (b.state === "LAND") {
      const dir3 = normalize3OrFallback(0, 0, -bird.pos.wzOffset, p.epsilon);
      const stepTiles = p.flySpeedTilesPerSec * dt;
      bird.pos.wzOffset = Math.max(0, bird.pos.wzOffset + dir3.z * stepTiles);
    } else {
      bird.pos.wzOffset = 0;
      bird.render.flipX = false;
    }
  }

  if (shouldRepickAllTargets) {
    updateUserSettings({
      debug: {
        neutralBirdAI: {
          ...settings.debug.neutralBirdAI,
          debugRepickTarget: false,
        },
      },
    });
  }
}
