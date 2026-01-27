// src/game/factories/zoneFactory.ts
import type { World } from "../world";

export const ZONE_KIND = {
    AURA: 1,
    FIRE: 2, // molotov later
    EXPLOSION: 3, // NEW: visual-only
} as const;

export type SpawnZoneArgs = {
    kind: number;

    x: number;
    y: number;

    radius: number;
    damage: number;        // damage per tick
    tickEvery: number;     // seconds between ticks
    ttl: number;           // seconds, use Infinity for “permanent”
    followPlayer?: boolean;
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
    w.zTickLeft.push(Math.max(0.02, a.tickEvery)); // start ticking soon-ish

    w.zTtl.push(a.ttl);
    w.zFollowPlayer.push(!!a.followPlayer);

    return i;
}
