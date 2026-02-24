import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export type NavArrowTarget =
  | { kind: "BOSS"; worldX: number; worldY: number }
  | { kind: "ZONE"; worldX: number; worldY: number }
  | null;

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function readPlayerWorld(world: any): { x: number; y: number } {
  if (typeof world?.playerWorld?.x === "number" && typeof world?.playerWorld?.y === "number") {
    return { x: world.playerWorld.x, y: world.playerWorld.y };
  }
  if (typeof world?.player?.x === "number" && typeof world?.player?.y === "number") {
    return { x: world.player.x, y: world.player.y };
  }
  const tileWorld = world?.tileWorld ?? world?.KENNEY_TILE_WORLD ?? KENNEY_TILE_WORLD;
  const gx = (world?.pgxi ?? 0) + (world?.pgox ?? 0);
  const gy = (world?.pgyi ?? 0) + (world?.pgoy ?? 0);
  return { x: gx * tileWorld, y: gy * tileWorld };
}

function zoneCenterWorld(world: any, z: { tx?: number; ty?: number; w?: number; h?: number; tileX?: number; tileY?: number; tileW?: number; tileH?: number }): { x: number; y: number } {
  const tileWorld = world?.tileWorld ?? world?.KENNEY_TILE_WORLD ?? KENNEY_TILE_WORLD;
  const txLocal = z.tx ?? z.tileX ?? 0;
  const tyLocal = z.ty ?? z.tileY ?? 0;
  const originTx = world?.zoneTrial?.originTx ?? world?.zoneTrialOriginTx ?? 0;
  const originTy = world?.zoneTrial?.originTy ?? world?.zoneTrialOriginTy ?? 0;
  const tx = txLocal + originTx;
  const ty = tyLocal + originTy;
  const w = z.w ?? z.tileW ?? 1;
  const h = z.h ?? z.tileH ?? 1;
  const cx = (tx + w * 0.5) * tileWorld;
  const cy = (ty + h * 0.5) * tileWorld;
  return { x: cx, y: cy };
}

export function resolveNavArrowTarget(world: any): NavArrowTarget {
  const p = readPlayerWorld(world);
  const px = p.x;
  const py = p.y;

  const archetype = world?.floorArchetype ?? world?.floorKind ?? world?.currentFloorArchetype;

  // 1) Boss triple floors: nearest uncompleted spawn point
  if (archetype === "BOSS_TRIPLE") {
    const sp = world?.bossTriple?.spawnPointsWorld as Array<{ x: number; y: number }> | undefined;
    const done = world?.bossTriple?.completed as boolean[] | undefined;
    if (!sp || !sp.length) return null;

    let bestI = -1;
    let bestD2 = Infinity;

    for (let i = 0; i < sp.length; i++) {
      if (done?.[i]) continue;
      const d2 = dist2(px, py, sp[i].x, sp[i].y);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
      }
    }

    if (bestI >= 0) return { kind: "BOSS", worldX: sp[bestI].x, worldY: sp[bestI].y };
    return null;
  }

  // 2) Zone trial floors: nearest uncompleted zone center
  if (archetype === "ZONE_TRIAL" || archetype === "TIME_TRIAL") {
    const zones = world?.zoneTrial?.zones as
      | Array<{ tx: number; ty: number; w: number; h: number; completed: boolean }>
      | undefined;
    if (!zones || !zones.length) return null;

    let best: { x: number; y: number; d2: number } | null = null;

    for (const z of zones) {
      if (z.completed) continue;
      const c = zoneCenterWorld(world, z);
      const d2 = dist2(px, py, c.x, c.y);
      if (!best || d2 < best.d2) best = { x: c.x, y: c.y, d2 };
    }

    if (best) return { kind: "ZONE", worldX: best.x, worldY: best.y };
    return null;
  }

  return null;
}
