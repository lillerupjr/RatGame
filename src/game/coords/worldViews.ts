import type { World } from "../world";
import { gridAtPlayer } from "../world";
import { gridToWorld } from "./grid";
import { KENNEY_TILE_WORLD } from "../visual/kenneyTiles";

export function getPlayerWorld(w: World, tileWorld = KENNEY_TILE_WORLD) {
  const pg = gridAtPlayer(w);
  return gridToWorld(pg.gx, pg.gy, tileWorld);
}

export function getEnemyWorld(w: World, i: number, tileWorld = KENNEY_TILE_WORLD) {
  const gx = w.egxi[i] + w.egox[i];
  const gy = w.egyi[i] + w.egoy[i];
  return gridToWorld(gx, gy, tileWorld);
}

export function getProjectileWorld(w: World, i: number, tileWorld = KENNEY_TILE_WORLD) {
  const gx = w.prgxi[i] + w.prgox[i];
  const gy = w.prgyi[i] + w.prgoy[i];
  return gridToWorld(gx, gy, tileWorld);
}

export function getPickupWorld(w: World, i: number, tileWorld = KENNEY_TILE_WORLD) {
  const gx = w.xgxi[i] + w.xgox[i];
  const gy = w.xgyi[i] + w.xgoy[i];
  return gridToWorld(gx, gy, tileWorld);
}

export function getZoneWorld(w: World, i: number, tileWorld = KENNEY_TILE_WORLD) {
  const gx = w.zgxi[i] + w.zgox[i];
  const gy = w.zgyi[i] + w.zgoy[i];
  return gridToWorld(gx, gy, tileWorld);
}
