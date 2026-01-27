// src/game/factories/projectileFactory.ts
import type { World } from "../world";

export type ProjectileSource = "KNIFE" | "PISTOL" | "SWORD" | "KNUCKLES" | "OTHER";

export const PRJ_KIND = {
    KNIFE: 1,
    PISTOL: 2,
    SWORD: 3,
    KNUCKLES: 4,
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
    w.prTtl.push(a.ttl);

    w.prStartX.push(a.x);
    w.prStartY.push(a.y);
    w.prMaxDist.push(a.maxDist ?? 0);

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

    return i;
}

export function spawnSwordProjectile(w: World, args: Omit<SpawnProjectileArgs, "kind">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.SWORD });
}

export function spawnKnucklesOrbital(w: World, args: Omit<SpawnProjectileArgs, "kind" | "orbital">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.KNUCKLES, orbital: true });
}
