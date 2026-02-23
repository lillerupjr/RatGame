// src/game/factories/projectileFactory.ts
import type { World } from "../../engine/world/world";
import { gridToWorld } from "../coords/grid";
import { anchorFromWorld } from "../coords/anchor";
import { KENNEY_TILE_WORLD } from "../../engine/render/kenneyTiles";

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
    dmgPhys?: number;
    dmgFire?: number;
    dmgChaos?: number;
    critChance?: number;
    critMulti?: number;
    chanceBleed?: number;
    chanceIgnite?: number;
    chancePoison?: number;
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

    // NEW (Milestone C): can this projectile damage the player?
    hitsPlayer?: boolean;

    // NEW (Milestone C): optional explicit projectile Z (otherwise derived from shooter)
    z?: number;

    // NEW (Height-based): explicit logical layer for this projectile
    zLogical?: number;
};

export type SpawnProjectileGridArgs = Omit<SpawnProjectileArgs, "x" | "y" | "dirX" | "dirY"> & {
    gx: number;
    gy: number;
    dirGx: number;
    dirGy: number;
    tileWorld?: number;
};



/** Spawn a projectile from world coordinates and initialize its SoA fields. */
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

    // Milestone C: flat-Z projectiles (no gravity yet)
    const shooterZ = w.pzVisual ?? w.pz ?? 0;
    const projZ = Number.isFinite(a.z as any) ? (a.z as number) : (shooterZ + 1);
    const spawnLayer = Number.isFinite(a.zLogical as any)
        ? (a.zLogical as number)
        : (Number.isFinite(w.pzLogical as any) ? (w.pzLogical + 1) : Math.ceil(projZ - 1e-6));


    w.pAlive.push(true);
    w.prHidden.push(false);
    w.prjKind.push(a.kind);
    (w as any)._lastFireProjKind = a.kind;

    const anchor = anchorFromWorld(a.x, a.y, KENNEY_TILE_WORLD);
    const gp = { gx: anchor.gxi + anchor.gox, gy: anchor.gyi + anchor.goy };
    w.prgxi.push(anchor.gxi);
    w.prgyi.push(anchor.gyi);
    w.prgox.push(anchor.gox);
    w.prgoy.push(anchor.goy);
    const wp = gridToWorld(gp.gx, gp.gy, KENNEY_TILE_WORLD);
    const wx = wp.wx;
    const wy = wp.wy;

    // Milestone C: projectile height (keep index-aligned)
    w.prZ.push(projZ);
    w.prZVisual.push(projZ);
    w.prZLogical.push(spawnLayer);

    // Milestone C: projectile can-hit-player flag (keep index-aligned)
    w.prHitsPlayer.push(!!a.hitsPlayer);

    // velocity
    w.prvx.push(vx);
    w.prvy.push(vy);

    const dmgPhys = Number.isFinite(a.dmgPhys as any) ? Math.max(0, a.dmgPhys as number) : Math.max(0, a.damage);
    const dmgFire = Number.isFinite(a.dmgFire as any) ? Math.max(0, a.dmgFire as number) : 0;
    const dmgChaos = Number.isFinite(a.dmgChaos as any) ? Math.max(0, a.dmgChaos as number) : 0;
    const totalDamage = Number.isFinite(a.damage as any)
      ? Math.max(0, a.damage)
      : (dmgPhys + dmgFire + dmgChaos);
    w.prDamage.push(totalDamage);
    w.prDmgPhys.push(dmgPhys);
    w.prDmgFire.push(dmgFire);
    w.prDmgChaos.push(dmgChaos);
    w.prCritChance.push(Number.isFinite(a.critChance as any) ? (a.critChance as number) : 0);
    w.prCritMulti.push(Number.isFinite(a.critMulti as any) ? (a.critMulti as number) : 1);
    w.prChanceBleed.push(Number.isFinite(a.chanceBleed as any) ? (a.chanceBleed as number) : 0);
    w.prChanceIgnite.push(Number.isFinite(a.chanceIgnite as any) ? (a.chanceIgnite as number) : 0);
    w.prChancePoison.push(Number.isFinite(a.chancePoison as any) ? (a.chancePoison as number) : 0);
    w.prR.push(a.radius);
    w.prPierce.push(a.pierce);

    // Bounce counter (index-aligned with all other projectile arrays)
    w.prBouncesLeft.push(Number.isFinite(a.bounces as any) ? (a.bounces as number) : -1);
    w.prWallBounce.push(!!a.wallBounce);

    // no-collide flag
    w.prNoCollide.push(!!a.noCollide);

    w.prTtl.push(a.ttl);

    w.prStartX.push(wx);
    w.prStartY.push(wy);
    w.prMaxDist.push(a.maxDist ?? 0);

    // static target + explosion config
    const hasTarget = Number.isFinite(a.targetX as any) && Number.isFinite(a.targetY as any);
    w.prHasTarget.push(!!hasTarget);
    w.prTargetX.push(hasTarget ? (a.targetX as number) : 0);
    w.prTargetY.push(hasTarget ? (a.targetY as number) : 0);

    // NOTE: prExplodeR is already a core array in World; push exactly once.
    w.prExplodeR.push(Math.max(0, a.explodeRadius ?? 0));
    w.prExplodeDmg.push(0);
    w.prExplodeTtl.push(0);

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

    // Fission arrays (nuclear fission bouncer evolution)
    w.prFission.push(false);
    w.prFissionCd.push(0);

    // poison payload defaults
    w.prPoisonDps.push(0);
    w.prPoisonDur.push(0);

    // last-hit lockouts
    w.prLastHitEnemy.push(-1);
    w.prLastHitCd.push(0);

    // bazooka evolution aftershock payload defaults
    w.prAftershockN.push(0);
    w.prAftershockDelay.push(0);
    w.prAftershockRingR.push(0);
    w.prAftershockWaves.push(0);
    w.prAftershockRingStep.push(0);

    return i;
}

/** Spawn a projectile from grid coordinates and grid-space direction. */
export function spawnProjectileGrid(w: World, a: SpawnProjectileGridArgs) {
    const tileWorld = a.tileWorld ?? KENNEY_TILE_WORLD;
    const pos = gridToWorld(a.gx, a.gy, tileWorld);
    const dir = gridToWorld(a.dirGx, a.dirGy, tileWorld);
    const { gx, gy, dirGx, dirGy, tileWorld: _tw, ...rest } = a;
    return spawnProjectile(w, { ...rest, x: pos.wx, y: pos.wy, dirX: dir.wx, dirY: dir.wy });
}

/** Spawn a sword projectile using grid-space coordinates. */
export function spawnSwordProjectileGrid(w: World, args: Omit<SpawnProjectileGridArgs, "kind">) {
    return spawnProjectileGrid(w, { ...args, kind: PRJ_KIND.SWORD });
}

/** Spawn a knuckles orbital projectile using grid-space coordinates. */
export function spawnKnucklesOrbitalGrid(
    w: World,
    args: Omit<SpawnProjectileGridArgs, "kind" | "orbital">
) {
    return spawnProjectileGrid(w, { ...args, kind: PRJ_KIND.KNUCKLES, orbital: true });
}


/** Spawn a sword projectile using world coordinates. */
export function spawnSwordProjectile(w: World, args: Omit<SpawnProjectileArgs, "kind">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.SWORD });
}

/** Spawn a knuckles orbital projectile using world coordinates. */
export function spawnKnucklesOrbital(w: World, args: Omit<SpawnProjectileArgs, "kind" | "orbital">) {
    return spawnProjectile(w, { ...args, kind: PRJ_KIND.KNUCKLES, orbital: true });
}
