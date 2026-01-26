import type { World } from "../world";
import { spawnProjectile } from "../world";

export type WeaponId = "KNIFE" | "PISTOL";
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
            const damageBase = 7;
            const damagePer = 1.2;

            const baseFanArc = 0.35;
            const fanArcPer = 0.22;
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
            const fanArc = Math.max(0, s.fanArc ?? 0);

            const baseAngle = Math.atan2(aim.y, aim.x);
            const half = fanArc / 2;

            // always center projectile first
            const center = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
            spawnProjectile(
                w,
                1,
                w.px,
                w.py,
                center.x * s.projectileSpeed,
                center.y * s.projectileSpeed,
                s.damage,
                s.projectileRadius,
                s.pierce ?? 0
            );

            if (count === 1) return;

            // spread remaining blades symmetrically
            let spawned = 1;
            const remaining = count - 1;
            const step = remaining === 1 ? half : half / Math.ceil(remaining / 2);

            for (let k = 1; spawned < count; k++) {
                const off = Math.min(half, k * step);

                if (spawned < count) {
                    const dir = rotate(center.x, center.y, -off);
                    spawnProjectile(
                        w,
                        1,
                        w.px,
                        w.py,
                        dir.x * s.projectileSpeed,
                        dir.y * s.projectileSpeed,
                        s.damage,
                        s.projectileRadius,
                        s.pierce ?? 0
                    );
                    spawned++;
                }

                if (spawned < count) {
                    const dir = rotate(center.x, center.y, +off);
                    spawnProjectile(
                        w,
                        1,
                        w.px,
                        w.py,
                        dir.x * s.projectileSpeed,
                        dir.y * s.projectileSpeed,
                        s.damage,
                        s.projectileRadius,
                        s.pierce ?? 0
                    );
                    spawned++;
                }

                if (off >= half) break;
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
            spawnProjectile(
                w,
                2,
                w.px,
                w.py,
                aim.x * s.projectileSpeed,
                aim.y * s.projectileSpeed,
                s.damage,
                s.projectileRadius,
                s.pierce ?? 0
            );
        },
    },
};
