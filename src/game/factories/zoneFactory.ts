// src/game/factories/zoneFactory.ts
import type { World } from "../world";

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

export function spawnZone(w: World, a: SpawnZoneArgs) {
    const i = w.zAlive.length;

    w.zAlive.push(true);
    w.zKind.push(a.kind);

    w.zx.push(a.x);
    w.zy.push(a.y);

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
