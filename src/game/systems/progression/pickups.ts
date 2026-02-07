import { World } from "../../../engine/world/world";
import type { DropId } from "../../content/drops";
import { gridToWorld } from "../../coords/grid";
import { anchorFromWorld, writeAnchor } from "../../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../../engine/render/kenneyTiles";
import { getPickupWorld, getPlayerWorld } from "../../coords/worldViews";
import { handleChestPickup } from "../sim/pickupHandlers";

export const PICKUP_KIND = {
  XP: 1,
  CHEST: 2,
} as const;

export function handlePickupSpecialCase(w: World, i: number, kind: number): boolean {
  if (kind === PICKUP_KIND.CHEST) {
    handleChestPickup(w, i);
    return true;
  }

  return false;
}

/** Update pickup movement (vacuum/magnet) and sync grid anchors. */
export function pickupsSystem(w: World, dt: number) {
  const syncPickupGrid = (i: number, wx: number, wy: number) => {
    const anchor = anchorFromWorld(wx, wy, KENNEY_TILE_WORLD);
    writeAnchor({ gxi: w.xgxi, gyi: w.xgyi, gox: w.xgox, goy: w.xgoy }, i, anchor);
  };

  // Update magnet timer
  if (w.magnetActive) {
    w.magnetTimer -= dt;
    if (w.magnetTimer <= 0) {
      w.magnetActive = false;
      w.magnetTimer = 0;
    }
  }

  // Pickups drift toward player when close (classic vacuum feel)
  // OR when magnet is active (pulls ALL XP from anywhere)
  const pw = getPlayerWorld(w, KENNEY_TILE_WORLD);
  const px = pw.wx;
  const py = pw.wy;

  for (let i = 0; i < w.xAlive.length; i++) {
    if (!w.xAlive[i]) continue;

    const wp = getPickupWorld(w, i, KENNEY_TILE_WORLD);
    let wx = wp.wx;
    let wy = wp.wy;
    const dx = px - wx;
    const dy = py - wy;
    const d = Math.hypot(dx, dy);
    
    // Magnet pulls all XP pickups regardless of distance
    const isXp = (w.xKind[i] ?? PICKUP_KIND.XP) === PICKUP_KIND.XP;
    const shouldPull = d < w.pickupRadius || (w.magnetActive && isXp);
    
    if (shouldPull) {
      // Magnet pulls faster and from further away
      const pull = w.magnetActive && isXp ? 800 : 420; // px/s
      const ux = dx / (d || 1);
      const uy = dy / (d || 1);
      wx += ux * pull * dt;
      wy += uy * pull * dt;
      syncPickupGrid(i, wx, wy);
    }
  }
}

/** Spawn an XP pickup at world coordinates. */
export function spawnXp(w: World, x: number, y: number, value: number) {
  const i = w.xAlive.length;

  w.xAlive.push(true);
  w.xKind.push(PICKUP_KIND.XP);
  const anchor = anchorFromWorld(x, y, KENNEY_TILE_WORLD);
  w.xgxi.push(anchor.gxi);
  w.xgyi.push(anchor.gyi);
  w.xgox.push(anchor.gox);
  w.xgoy.push(anchor.goy);
  w.xValue.push(value);
  w.xDropId.push("");

  return i;
}

/** Spawn an XP pickup at grid coordinates. */
export function spawnXpGrid(
  w: World,
  gx: number,
  gy: number,
  value: number,
  tileWorld: number = KENNEY_TILE_WORLD
) {
  const pos = gridToWorld(gx, gy, tileWorld);
  return spawnXp(w, pos.wx, pos.wy, value);
}

/** Spawn a chest pickup at world coordinates. */
export function spawnChest(w: World, x: number, y: number, dropId: DropId = "BOSS_CHEST") {
  const i = w.xAlive.length;

  w.xAlive.push(true);
  w.xKind.push(PICKUP_KIND.CHEST);
  const anchor = anchorFromWorld(x, y, KENNEY_TILE_WORLD);
  w.xgxi.push(anchor.gxi);
  w.xgyi.push(anchor.gyi);
  w.xgox.push(anchor.gox);
  w.xgoy.push(anchor.goy);
  w.xValue.push(0);
  w.xDropId.push(dropId);

  return i;
}

/** Spawn a chest pickup at grid coordinates. */
export function spawnChestGrid(
  w: World,
  gx: number,
  gy: number,
  dropId: DropId = "BOSS_CHEST",
  tileWorld: number = KENNEY_TILE_WORLD
) {
  const pos = gridToWorld(gx, gy, tileWorld);
  return spawnChest(w, pos.wx, pos.wy, dropId);
}
