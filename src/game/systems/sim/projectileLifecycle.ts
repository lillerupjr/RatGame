import { emitEvent, type World } from "../../../engine/world/world";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getProjectileWorld } from "../../coords/worldViews";
import { getProjectileHitVfx } from "../../content/projectilePresentationRegistry";

type ProjectileDeathPosition = {
  x?: number;
  y?: number;
};

export function spawnProjectileHitVfx(
  w: World,
  projectileKind: number,
  x: number,
  y: number,
): void {
  const hit = getProjectileHitVfx(projectileKind);
  if (!hit) return;
  emitEvent(w, {
    type: "VFX",
    id: hit.vfxKey,
    x,
    y,
    scale: 1,
  });
}

export function despawnProjectile(
  w: World,
  projectileIndex: number,
  position: ProjectileDeathPosition = {},
): void {
  if (!w.pAlive[projectileIndex]) return;
  const projectileWorld = getProjectileWorld(w, projectileIndex, KENNEY_TILE_WORLD);
  const x = Number.isFinite(position.x) ? Number(position.x) : projectileWorld.wx;
  const y = Number.isFinite(position.y) ? Number(position.y) : projectileWorld.wy;
  spawnProjectileHitVfx(w, w.prjKind[projectileIndex], x, y);
  w.pAlive[projectileIndex] = false;
}
