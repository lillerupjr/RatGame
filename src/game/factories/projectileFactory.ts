import type { World } from "../world";

export type ProjectileSource = "KNIFE" | "PISTOL" | "OTHER";

// Your existing world uses prjKind: 1 knife, 2 pistol (keep that for now)
export const PRJ_KIND = {
    KNIFE: 1,
    PISTOL: 2,
} as const;

export type SpawnProjectileArgs = {
    kind: number; // matches world.prjKind values
    x: number;
    y: number;

    // direction (will be normalized)
    dirX: number;
    dirY: number;

    speed: number;
    damage: number;
    radius: number;
    pierce: number;

    // NEW: max travel distance in world pixels (0 = unlimited)
    maxDist?: number;
    // lifetime in seconds
    ttl: number;
};

/**
 * Factory: spawns a projectile with a static velocity.
 * After spawn, its velocity is NEVER updated again (no homing).
 */
export function spawnProjectile(w: World, a: SpawnProjectileArgs) {
    let dx = a.dirX;
    let dy = a.dirY;

    const len = Math.hypot(dx, dy);
    if (len < 0.0001) {
        dx = 1;
        dy = 0;
    } else {
        dx /= len;
        dy /= len;
    }

    const vx = dx * a.speed;
    const vy = dy * a.speed;

    const i = w.pAlive.length;
    w.pAlive.push(true);
    w.prjKind.push(a.kind);
    w.prx.push(a.x);
    w.pry.push(a.y);
    w.prvx.push(vx);
    w.prvy.push(vy);
    w.prDamage.push(a.damage);
    w.prR.push(a.radius);
    w.prPierce.push(a.pierce);
    w.prTtl.push(a.ttl);
    w.prStartX.push(a.x);
    w.prStartY.push(a.y);
    w.prMaxDist.push(a.maxDist ?? 0);

    return i;
}

/** Convenience helpers (optional but nice) */
export function spawnKnifeProjectile(w: World, args: Omit<SpawnProjectileArgs, "kind">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.KNIFE });
}

export function spawnPistolBullet(w: World, args: Omit<SpawnProjectileArgs, "kind">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.PISTOL });
}
