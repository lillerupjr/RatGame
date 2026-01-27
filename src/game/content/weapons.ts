// src/game/content/weapons.ts
import type { World } from "../world";
import { spawnProjectile, spawnSwordProjectile, spawnKnucklesOrbital, PRJ_KIND } from "../factories/projectileFactory";

export type WeaponId =
    | "KNIFE"
    | "PISTOL"
    | "KNIFE_EVOLVED_RING"
    | "PISTOL_EVOLVED_SPIRAL"
    | "SWORD"
    | "KNUCKLES";

export const MAX_WEAPON_LEVEL = 10;

export type Aim = { x: number; y: number };

export type WeaponStats = {
    cooldown: number;
    projectileSpeed: number;
    projectileRadius: number;
    damage: number;

    projectileCount?: number;
    fanArc?: number;
    pierce?: number;

    meleeCone?: number;
    meleeRange?: number;

    // for orbitals
    duration?: number;
    orbitBaseRadius?: number;
    orbitBaseAngVel?: number; // radians/sec
};

export type WeaponDef = {
    id: WeaponId;
    title: string;

    hiddenFromPools?: boolean;
    evolvedFrom?: WeaponId;

    getStats: (level: number, w: World) => WeaponStats;
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

            // Spread
            const baseFanArc = 0.28;
            const fanArcPer = 0.16;
            const fanArc = Math.min(Math.PI, baseFanArc + (lv - 1) * fanArcPer);

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 460,
                projectileRadius: 5,
                damage: (damageBase + (lv - 1) * damagePer) * w.dmgMult,
                projectileCount: lv,
                fanArc,
                pierce: 0,
            };
        },

        fire: (w, s, aim) => {
            const count = Math.max(1, s.projectileCount ?? 1);

            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 0.15;
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

            const isEven = (count % 2) === 0;
            const step = isEven ? (fanArc / count) : (fanArc / (count - 1));
            const start = baseAngle - half + (isEven ? step * 0.5 : 0);

            for (let i = 0; i < count; i++) {
                const ang = start + step * i;

                spawnProjectile(w, {
                    kind: PRJ_KIND.KNIFE,
                    x: w.px,
                    y: w.py,
                    dirX: Math.cos(ang),
                    dirY: Math.sin(ang),
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

    // --- EVOLUTION: Knife -> Ring burst ---
    KNIFE_EVOLVED_RING: {
        id: "KNIFE_EVOLVED_RING",
        title: "Knife Cyclone",
        hiddenFromPools: true,
        evolvedFrom: "KNIFE",

        getStats: (level, w) => {
            const lv = clampLevel(level);

            const cooldownBase = 1.05;
            const damageBase = 10;
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
            const maxDist = viewW * 0.18;
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
                pierce: 999,
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

    // --- EVOLUTION: Pistol -> Spiral (2 opposite bullets, rotating direction) ---
    PISTOL_EVOLVED_SPIRAL: {
        id: "PISTOL_EVOLVED_SPIRAL",
        title: "Spiral Viper",
        hiddenFromPools: true,
        evolvedFrom: "PISTOL",

        getStats: (level, w) => {
            const lv = clampLevel(level);
            const multiplier = 240;
            // "Same as pistol" (your choice)
            const cooldownBase = 1/multiplier;
            const dmg = (10 + (lv - 1) * 3) * w.dmgMult/multiplier;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 520,
                projectileRadius: 5,
                damage: dmg,
                // ONLY evolved pistol bullets pierce (your choice)
                pierce: 999,
            };
        },

        fire: (w, s, aim) => {
            // Persisted angle state on world (kept off World type like other systems do)
            // Clockwise rotation ≈ +90° per burst (medium)
            const multiplier = 4;
            const STEP = Math.PI / 2 / multiplier;

            const key = "_pistolSpiralAng";
            let ang = (w as any)[key] as number | undefined;

            // Initialize angle from current aim, so it feels responsive on first shot
            if (typeof ang !== "number" || !isFinite(ang)) {
                ang = Math.atan2(aim.y, aim.x);
            }

            // Fire two bullets in opposite directions
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);

            // Optional: range limit similar to knife (keeps perf sane)
            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW;
            const ttlSafety = 10;

            // Forward
            spawnProjectile(w, {
                kind: PRJ_KIND.PISTOL,
                x: w.px,
                y: w.py,
                dirX: dx,
                dirY: dy,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: s.pierce ?? 999,
                ttl: ttlSafety,
                maxDist,
            });

            // Opposite
            spawnProjectile(w, {
                kind: PRJ_KIND.PISTOL,
                x: w.px,
                y: w.py,
                dirX: -dx,
                dirY: -dy,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: s.pierce ?? 999,
                ttl: ttlSafety,
                maxDist,
            });

            // Advance angle clockwise for next burst
            ang += STEP;
            // keep it bounded
            if (ang > Math.PI * 2) ang -= Math.PI * 2;

            (w as any)[key] = ang;
        },
    },
    // --- Orbit weapon: Brass Knuckles / "Knuckle Ring" ---
    KNUCKLES: {
        id: "KNUCKLES",
        title: "Knuckle Ring",
        getStats: (level, w) => {
            const lv = clampLevel(level);

            // Fires often (spawn rate scales with FIRE_RATE via cooldown division)
            const cooldownBase = 0.18;

            // Damage scaling (tune later)
            const dmgBase = 9;
            const dmgPer = 1.4;

            // Orbital properties:
            // Base radius scales with level; final radius scales with AREA in projectilesSystem
            const orbitBaseRadius = 42 + (lv - 1) * 5.5;

            // Base angular velocity; final ang vel scales with MOVE_SPEED in projectilesSystem
            // (positive = clockwise here because canvas Y+ down; feel free to invert if you want)
            const orbitBaseAngVel = 6.5;

            // Duration scales with DURATION multiplier (applied at spawn)
            const baseDuration = 1.25 + (lv - 1) * 0.08;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 0,
                projectileRadius: 9,
                damage: (dmgBase + (lv - 1) * dmgPer) * w.dmgMult,
                pierce: 999, // orbitals should punch through
                duration: baseDuration * w.durationMult,
                orbitBaseRadius,
                orbitBaseAngVel,
            };
        },

        fire: (w, s, _aim) => {
            // spread newly spawned knuckles around the ring
            const key = "_knucklesSpawnAng";
            let ang = (w as any)[key] ?? 0;
            const step = Math.PI * 0.55; // pseudo-golden-ish spacing for nice distribution

            (w as any)[key] = ang + step;

            spawnKnucklesOrbital(w, {
                x: w.px,
                y: w.py,

                // dir is unused for orbitals, but keep sane values for arrays
                dirX: 1,
                dirY: 0,

                speed: 0,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: s.pierce ?? 999,

                ttl: s.duration ?? 1.2,

                // orbital params (base values; actual radius/angVel are scaled dynamically)
                orbAngle: ang,
                orbBaseRadius: s.orbitBaseRadius ?? 40,
                orbBaseAngVel: s.orbitBaseAngVel ?? 6.0,
            });
        },
    },
};
