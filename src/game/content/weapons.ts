import type { World } from "../world";
import { spawnProjectile, spawnSwordProjectile, PRJ_KIND } from "../factories/projectileFactory";


export type WeaponId = "KNIFE" | "PISTOL" | "SWORD";
export const MAX_WEAPON_LEVEL = 10;

export type Aim = { x: number; y: number };

export type WeaponStats = {
    cooldown: number;
    projectileSpeed: number;
    projectileRadius: number;
    damage: number;

    // optional
    projectileCount?: number;
    fanArc?: number; // radians
    pierce?: number;
    meleeCone?: number; // radians, for melee slashes
    meleeRange?: number; // reach for melee slashes (cone length)
};

export type WeaponDef = {
    id: WeaponId;
    title: string;

    /** compute derived stats for this level */
    getStats: (level: number, w: World) => WeaponStats;

    /** spawn projectiles for one firing event (static direction, no homing) */
    fire: (w: World, stats: WeaponStats, aim: Aim) => void;
};

function clampLevel(level: number): number {
    return Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.floor(level)));
}

function rotate(ax: number, ay: number, ang: number) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: ax * c - ay * s, y: ax * s + ay * c };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
    KNIFE: {
        id: "KNIFE",
        title: "Throwing Knife",
        getStats: (level, w) => {
            const lv = clampLevel(level);

            const cooldownBase = 0.75;
            const damageBase = 20;
            const damagePer = 1.2;

            // Spread: slightly tighter than before
            const baseFanArc = 0.28; // was 0.35
            const fanArcPer = 0.16;  // was 0.22
            const fanArc = Math.min(Math.PI, baseFanArc + (lv - 1) * fanArcPer);

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 460,
                projectileRadius: 5,
                damage: (damageBase + (lv - 1) * damagePer) * w.dmgMult,
                projectileCount: lv, // +1 per level
                fanArc,
                pierce: 0,
            };
        },

        fire: (w, s, aim) => {
            const count = Math.max(1, s.projectileCount ?? 1);

            // Range (world pixels): 1/4 of screen width
            // NOTE: requires you to set w.viewW every frame (or uses fallback).
            // Range limiting is done by vector-space distance check in projectilesSystem,
            // using prStartX/prStartY + prMaxDist written by spawnProjectile().
            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 0.15;

            // TTL becomes just a safety cap now (distance is the real limiter)
            const ttlSafety = 10;

            const baseAngle = Math.atan2(aim.y, aim.x);

            // If only 1 projectile: straight ahead
            if (count === 1) {
                spawnProjectile(w, {
                    kind: PRJ_KIND.KNIFE,
                    x: w.px,
                    y: w.py,
                    dirX: Math.cos(baseAngle),
                    dirY: Math.sin(baseAngle),
                    speed: s.projectileSpeed,
                    damage: s.damage,
                    radius: s.projectileRadius,
                    pierce: s.pierce ?? 0,
                    ttl: ttlSafety,
                    maxDist,
                });
                return;
            }

            // Center blade rule:
            // - Odd count => includes center at baseAngle
            // - Even count => no center blade; symmetric around baseAngle
            const fanArc = Math.max(0, s.fanArc ?? 0);
            const half = fanArc * 0.5;

            const isEven = (count % 2) === 0;
            const step = isEven ? (fanArc / count) : (fanArc / (count - 1));
            const start = baseAngle - half + (isEven ? step * 0.5 : 0);

            for (let i = 0; i < count; i++) {
                const ang = start + step * i;
                const dx = Math.cos(ang);
                const dy = Math.sin(ang);

                spawnProjectile(w, {
                    kind: PRJ_KIND.KNIFE,
                    x: w.px,
                    y: w.py,
                    dirX: dx,
                    dirY: dy,
                    speed: s.projectileSpeed,
                    damage: s.damage,
                    radius: s.projectileRadius,
                    pierce: s.pierce ?? 0,
                    ttl: ttlSafety,
                    maxDist,
                });
            }
        },
    },

    PISTOL: {
        id: "PISTOL",
        title: "Pistol",
        getStats: (level, w) => {
            const lv = clampLevel(level);
            const cooldownBase = 0.55;
            const dmg = (10 + (lv - 1) * 3) * w.dmgMult;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 520,
                projectileRadius: 5,
                damage: dmg,
                pierce: 0,
            };
        },
        fire: (w, s, aim) => {
            spawnProjectile(w, {
                kind: PRJ_KIND.PISTOL,
                x: w.px,
                y: w.py,
                dirX: aim.x,
                dirY: aim.y,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: s.pierce ?? 0,
                ttl: 2.2,
            });
        },
    },
    SWORD: {
        id: "SWORD",
        title: "Sword",
        getStats: (level: number, w: World) => {
            const lv = clampLevel(level);
            const cooldownBase = 0.75;
            const dmg = (30 + (lv - 1) * 5) * w.dmgMult;

            // Cone grows with level: from 60deg to 360deg at max level
            const minCone = Math.PI / 3; // 60 deg
            const maxCone = Math.PI * 2; // 360 deg
            const t = (lv - 1) / (MAX_WEAPON_LEVEL - 1);
            const meleeCone = minCone + (maxCone - minCone) * t;

            // Range (cone length) grows modestly with level
            const minRange = 90;
            const maxRange = 150;
            const meleeRange = minRange + (maxRange - minRange) * t;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 0,
                projectileRadius: 35,
                damage: dmg,
                pierce: 2 + Math.floor((lv - 1) / 3),
                meleeCone,
                meleeRange,
            };
        },
        fire: (w: World, s: WeaponStats, aim: Aim) => {
            spawnSwordProjectile(w, {
                x: w.px,
                y: w.py,
                dirX: aim.x,
                dirY: aim.y,
                speed: 0,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: s.pierce ?? 0,
                ttl: 0.15,
                melee: true,
                coneAngle: s.meleeCone ?? Math.PI / 6,
                meleeRange: s.meleeRange ?? s.projectileRadius,
            });
        },
    },
};
