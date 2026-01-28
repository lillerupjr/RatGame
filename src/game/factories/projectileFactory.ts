// src/game/factories/projectileFactory.ts
import type { World } from "../world";

export type ProjectileSource =
    | "KNIFE"
    | "PISTOL"
    | "SWORD"
    | "KNUCKLES"
    | "SYRINGE"
    | "BOUNCER"
    | "OTHER";


export const PRJ_KIND = {
    KNIFE: 1,
    PISTOL: 2,
    SWORD: 3,
    KNUCKLES: 4,
    SYRINGE: 5,
    BOUNCER: 6,
    BAZOOKA: 7,
} as const;


export type SpawnProjectileArgs = {
    kind: number;
    x: number;
    y: number;

    dirX: number;
    dirY: number;

    speed: number;
    damage: number;
    radius: number;
    pierce: number;

    // Bounce mechanic
    // -1 (default) => not a bouncer, use normal pierce
    //  0+          => bouncer, consumes bounces on ricochet events
    bounces?: number;

    // If true, bouncer also reflects off screen edges.
    wallBounce?: boolean;

    maxDist?: number;
    ttl: number;

    melee?: boolean;
    coneAngle?: number;
    meleeRange?: number;

    // NEW: orbital
    orbital?: boolean;
    orbAngle?: number;
    orbBaseRadius?: number;
    orbBaseAngVel?: number;

    // NEW: “no-collide” projectile (used by Bazooka rocket)
    noCollide?: boolean;

    // NEW: static target coordinate (rocket explodes when it reaches this point)
    targetX?: number;
    targetY?: number;

    // NEW: explosion radius on arrival
    explodeRadius?: number;
};




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

    const isOrbital = !!a.orbital;

    const vx = isOrbital ? 0 : dx * a.speed;
    const vy = isOrbital ? 0 : dy * a.speed;

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

// Bounce counter (index-aligned with all other projectile arrays)
    w.prBouncesLeft.push(Number.isFinite(a.bounces as any) ? (a.bounces as number) : -1);
    w.prWallBounce.push(!!a.wallBounce);

// NEW: no-collide flag
    w.prNoCollide.push(!!a.noCollide);

    w.prTtl.push(a.ttl);

    w.prStartX.push(a.x);
    w.prStartY.push(a.y);
    w.prMaxDist.push(a.maxDist ?? 0);

// NEW: static target + explosion config
    const hasTarget = Number.isFinite(a.targetX as any) && Number.isFinite(a.targetY as any);
    w.prHasTarget.push(!!hasTarget);
    w.prTargetX.push(hasTarget ? (a.targetX as number) : 0);
    w.prTargetY.push(hasTarget ? (a.targetY as number) : 0);
    w.prExplodeR.push(Math.max(0, a.explodeRadius ?? 0));

    w.prIsmelee.push(a.melee ?? false);
    w.prCone.push(a.coneAngle ?? Math.PI / 6);
    w.prMeleeRange.push(a.meleeRange ?? a.radius);
    w.prDirX.push(dx);
    w.prDirY.push(dy);

    // orbital arrays (must stay index-aligned)
    w.prIsOrbital.push(isOrbital);
    w.prOrbAngle.push(a.orbAngle ?? 0);
    w.prOrbBaseRadius.push(a.orbBaseRadius ?? 0);
    w.prOrbBaseAngVel.push(a.orbBaseAngVel ?? 0);

    w.prPoisonDps.push(0);
    w.prPoisonDur.push(0);

    w.prLastHitEnemy.push(-1);
    w.prLastHitCd.push(0);

    // NEW: explode payload defaults (index-aligned)
    (w as any).prExplodeR?.push(0);
    (w as any).prExplodeDmg?.push(0);
    (w as any).prExplodeTtl?.push(0);
    w.prPoisonDps.push(0);
    w.prPoisonDur.push(0);

    // NEW: bazooka evolution aftershock payload (index-aligned)
    (w as any).prAftershockN?.push(0);
    (w as any).prAftershockDelay?.push(0);
    (w as any).prAftershockRingR?.push(0);

    w.prLastHitEnemy.push(-1);
    w.prLastHitCd.push(0);


    return i;
}

export function spawnSwordProjectile(w: World, args: Omit<SpawnProjectileArgs, "kind">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.SWORD });
}

export function spawnKnucklesOrbital(w: World, args: Omit<SpawnProjectileArgs, "kind" | "orbital">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.KNUCKLES, orbital: true });
}
