// src/game/content/weapons.ts
import type { World } from "../world";
import { spawnProjectile, PRJ_KIND } from "../factories/projectileFactory";

export type WeaponId = "KNIFE" | "PISTOL" | "KNIFE_EVOLVED_RING";
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

    /**
     * If true, weapon will NOT appear in:
     * - starter weapon picker
     * - "add weapon" upgrades
     * - "level weapon" upgrades (unless you explicitly include it)
     */
    hiddenFromPools?: boolean;

    /** If set, UI can show "EVOLUTION" etc. */
    evolvedFrom?: WeaponId;

    /** compute derived stats for this level */
    getStats: (level: number, w: World) => WeaponStats;

    /** spawn projectiles for one firing event (static direction, no homing) */
    fire: (w: World, stats: WeaponStats, aim: Aim) => void;
};

function clampLevel(level: number): number {
    return Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.floor(level)));
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
            const baseFanArc = 0.28;
            const fanArcPer = 0.16;
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

            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 0.25;

            const ttlSafety = 10;
            const baseAngle = Math.atan2(aim.y, aim.x);

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

            const fanArc = Math.max(0, s.fanArc ?? 0);
            const half = fanArc * 0.5;

            const isEven = count % 2 === 0;
            const step = isEven ? fanArc / count : fanArc / (count - 1);
            const start = baseAngle - half + (isEven ? step * 0.5 : 0);

            for (let k = 0; k < count; k++) {
                const a = start + k * step;
                spawnProjectile(w, {
                    kind: PRJ_KIND.KNIFE,
                    x: w.px,
                    y: w.py,
                    dirX: Math.cos(a),
                    dirY: Math.sin(a),
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

    // --- EVOLUTION ---
    // Fires 24 knives in a perfect ring outward from the player.
    KNIFE_EVOLVED_RING: {
        id: "KNIFE_EVOLVED_RING",
        title: "Knife Cyclone",
        hiddenFromPools: true,
        evolvedFrom: "KNIFE",

        getStats: (level, w) => {
            // You can decide later if evolved weapons level up.
            // For now, it still supports levels (if you ever choose to).
            const lv = clampLevel(level);

            const cooldownBase = 1.05;  // slower, big burst
            const damageBase = 10;      // per projectile (24 projectiles)
            const damagePer = 0.9;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 440,
                projectileRadius: 5,
                damage: (damageBase + (lv - 1) * damagePer) * w.dmgMult,
                projectileCount: 24,
                pierce: 0,
            };
        },

        fire: (w, s, _aim) => {
            const count = 24;

            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 0.40;
            const ttlSafety = 10;

            for (let k = 0; k < count; k++) {
                const a = (k / count) * Math.PI * 2;
                spawnProjectile(w, {
                    kind: PRJ_KIND.KNIFE,
                    x: w.px,
                    y: w.py,
                    dirX: Math.cos(a),
                    dirY: Math.sin(a),
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
};
