// src/game/factories/zoneFactory.ts
import type { World } from "../../engine/world/world";
import { gridToWorld } from "../coords/grid";
import { anchorFromWorld } from "../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

export const ZONE_KIND = {
    AURA: 1,
    FIRE: 2,
    EXPLOSION: 3,

    // NEW: boss telegraph + hazards
    TELEGRAPH: 4, // warning only
    HAZARD: 5,    // damages player (optional) and/or enemies
} as const;

export type SpawnZoneArgs = {
    kind: number;

    x: number;
    y: number;

    radius: number;
    damage: number;        // damage per tick to enemies
    tickEvery: number;     // seconds between ticks
    ttl: number;           // seconds (Infinity allowed)
    followPlayer?: boolean;

    // NEW: optional damage per tick to player (used by boss hazards)
    damagePlayer?: number;
};

export type SpawnZoneGridArgs = Omit<SpawnZoneArgs, "x" | "y"> & {
    gx: number;
    gy: number;
    tileWorld?: number;
};

/** Spawn a zone at world coordinates and initialize its SoA fields. */
export function spawnZone(w: World, a: SpawnZoneArgs) {
    const i = w.zAlive.length;

    w.zAlive.push(true);
    w.zKind.push(a.kind);
    const anchor = anchorFromWorld(a.x, a.y, KENNEY_TILE_WORLD);
    w.zgxi.push(anchor.gxi);
    w.zgyi.push(anchor.gyi);
    w.zgox.push(anchor.gox);
    w.zgoy.push(anchor.goy);


    w.zR.push(a.radius);
    w.zDamage.push(a.damage);

    w.zTickEvery.push(Math.max(0.02, a.tickEvery));
    w.zTickLeft.push(Math.max(0.02, a.tickEvery));

    w.zTtl.push(a.ttl);
    w.zFollowPlayer.push(!!a.followPlayer);

    // NEW
    w.zDamagePlayer.push(Math.max(0, a.damagePlayer ?? 0));

    return i;
}

/** Spawn a zone at grid coordinates. */
export function spawnZoneGrid(w: World, a: SpawnZoneGridArgs) {
    const tileWorld = a.tileWorld ?? KENNEY_TILE_WORLD;
    const pos = gridToWorld(a.gx, a.gy, tileWorld);
    const { gx, gy, tileWorld: _tw, ...rest } = a;
    return spawnZone(w, { ...rest, x: pos.wx, y: pos.wy });
}
