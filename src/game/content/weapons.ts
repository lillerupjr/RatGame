// src/game/content/weapons.ts
import type { World } from "../world";
import { spawnProjectile, spawnSwordProjectile, spawnKnucklesOrbital, PRJ_KIND } from "../factories/projectileFactory";
import { spawnZone, ZONE_KIND } from "../factories/zoneFactory";
import type { TargetingStrategy } from "../util/targeting";
import { findTarget, getEnemiesInRange } from "../util/targeting";


export type WeaponId =
    | "KNIFE"
    | "KNIFE_EVOLVED_RING"
    | "PISTOL"
    | "PISTOL_EVOLVED_SPIRAL"
    | "SYRINGE"
    | "SYRINGE_EVOLVED_CHAIN"
    | "SWORD"
    | "KNUCKLES"
    | "AURA"
    | "MOLOTOV"
    | "BOUNCER"
    | "BOUNCER_EVOLVED_BANKSHOT"
    | "BAZOOKA"
    | "BAZOOKA_EVOLVED";


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

    // Targeting configuration
    targeting?: TargetingStrategy;   // defaults to CLOSEST
    targetingRange?: number;         // max range for target acquisition (0 = unlimited)
    clusterRadius?: number;          // for CLUSTER strategy, radius to consider enemies grouped
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

            const cooldownBase = 0.3;
            const damageBase = 10;
            const damagePer = 0.9;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 700,
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
    // --- EVOLUTION: Pistol -> Spiral (2 opposite bullets, rotating direction) ---
    PISTOL_EVOLVED_SPIRAL: {
        id: "PISTOL_EVOLVED_SPIRAL",
        title: "Spiral Viper",
        hiddenFromPools: true,
        evolvedFrom: "PISTOL",

        getStats: (level, w) => {
            const lv = clampLevel(level);
            const multiplier = 60;
            // "Same as pistol" (your choice)
            const cooldownBase = 1/multiplier;
            const dmg = (10 + (lv - 1) * 3) * w.dmgMult;

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
            const multiplier = 10;
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
    SYRINGE: {
        id: "SYRINGE",
        title: "Volatile Reagent",

        getStats: (level, w) => {
            const lv = clampLevel(level);

            // ---- Fire / needle baseline ----
            // Syringe identity is poison + conditional explosions, not raw hit damage.
            const cooldownBase = 2;

            // Needle feel: fast, small, short-ish life
            const needleSpeed = 200;

            // Small direct hit (still scales with dmgMult)
            const hitDmgBase = 4.0;
            const hitDmgPer = 0.8;
            const hitDamage = (hitDmgBase + (lv - 1) * hitDmgPer) * w.dmgMult;

            // ---- Poison payload ----
            // DPS scales with dmgMult. Duration scales with durationMult.
            const poisonDpsBase = 20.0;
            const poisonDpsPer = 1.35;
            const poisonDps = (poisonDpsBase + (lv - 1) * poisonDpsPer) * w.dmgMult;

            const poisonDurBase = 5;
            const poisonDurPer = 0.18;
            const poisonDur = (poisonDurBase + (lv - 1) * poisonDurPer) * (w.durationMult ?? 1);

            // ---- Poison-gated explode-on-kill (handled by onKillExplodeSystem) ----
            // Explosions ONLY occur when a poisoned enemy dies.
            const pctBase = 0.2;
            const pctPer = 0.02;
            const pct = pctBase + (lv - 1) * pctPer;

            // Base radius before areaMult (system multiplies by areaMult)
            const radiusBase = 100;
            const radiusPer = 5.0;
            const baseRadius = radiusBase + (lv - 1) * radiusPer;

            (w as any)._explodeOnKill = {
                enabled: true,
                pct,
                baseRadius,
                maxPerFrame: 80,

                // Base syringe: explosions DO NOT apply poison (no free chains).
                applyPoison: false,
                poisonDur: poisonDur,
                poisonDps: poisonDps,
            };

            // We keep WeaponStats unchanged and stash poison fields as escape-hatch.
            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: needleSpeed,
                projectileRadius: 4,
                damage: hitDamage,
                pierce: 0,

                ...( { poisonDps, poisonDur } as any ),
            } as any;
        },

        fire: (w, s, aim) => {
            // Fire a single needle that applies poison on hit.
            // Requires projectileFactory + collisionsSystem support for:
            // - w.prPoisonDps[] / w.prPoisonDur[] arrays
            // - applying poison when projectile hits an enemy

            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 2;
            const ttlSafety = 10;

            const poisonDps = Math.max(0, (s as any).poisonDps ?? 0);
            const poisonDur = Math.max(0, (s as any).poisonDur ?? 0);

            const p = spawnProjectile(w, {
                kind: PRJ_KIND.SYRINGE,
                x: w.px,
                y: w.py,
                dirX: aim.x,
                dirY: aim.y,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: 999, // for now
                ttl: ttlSafety,
                maxDist,
            });

            // Attach poison payload (arrays must exist + be default-pushed on spawn)
            (w as any).prPoisonDps[p] = poisonDps;
            (w as any).prPoisonDur[p] = poisonDur;
        },
    },
// --- EVOLUTION: Syringe -> Chain reaction (explosion applies poison so kills can chain) ---
    SYRINGE_EVOLVED_CHAIN: {
        id: "SYRINGE_EVOLVED_CHAIN",
        title: "Chain Syringe",
        hiddenFromPools: true,
        evolvedFrom: "SYRINGE",

        getStats: (level, w) => {
            const lv = clampLevel(level);

            // ---- Fire / needle baseline ----
            // Syringe identity is poison + conditional explosions, not raw hit damage.
            const cooldownBase = 2;

            // Needle feel: fast, small, short-ish life
            const needleSpeed = 200;

            // Small direct hit (still scales with dmgMult)
            const hitDmgBase = 4.0;
            const hitDmgPer = 0.8;
            const hitDamage = (hitDmgBase + (lv - 1) * hitDmgPer) * w.dmgMult;

            // ---- Poison payload ----
            // DPS scales with dmgMult. Duration scales with durationMult.
            const poisonDpsBase = 20.0;
            const poisonDpsPer = 1.35;
            const poisonDps = (poisonDpsBase + (lv - 1) * poisonDpsPer) * w.dmgMult;

            const poisonDurBase = 5;
            const poisonDurPer = 0.18;
            const poisonDur = (poisonDurBase + (lv - 1) * poisonDurPer) * (w.durationMult ?? 1);

            // ---- Poison-gated explode-on-kill (handled by onKillExplodeSystem) ----
            // Explosions ONLY occur when a poisoned enemy dies.
            const pctBase = 0.20;
            const pctPer = 0.02;
            const pct = pctBase + (lv - 1) * pctPer;

            // Base radius before areaMult (system multiplies by areaMult)
            const radiusBase = 200;
            const radiusPer = 5.0;
            const baseRadius = radiusBase + (lv - 1) * radiusPer;

            (w as any)._explodeOnKill = {
                enabled: true,
                pct,
                baseRadius,
                maxPerFrame: 80,

                // Base syringe: explosions DO NOT apply poison (no free chains).
                applyPoison: true,
                poisonDur: poisonDur,
                poisonDps: poisonDps,
            };

            // We keep WeaponStats unchanged and stash poison fields as escape-hatch.
            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: needleSpeed,
                projectileRadius: 4,
                damage: hitDamage,
                pierce: 0,

                ...( { poisonDps, poisonDur } as any ),
            } as any;
        },

        fire: (w, s, aim) => {
            // Fire a single needle that applies poison on hit.
            // Requires projectileFactory + collisionsSystem support for:
            // - w.prPoisonDps[] / w.prPoisonDur[] arrays
            // - applying poison when projectile hits an enemy

            const viewW = (w as any).viewW ?? 800;
            const maxDist = viewW * 2;
            const ttlSafety = 10;

            const poisonDps = Math.max(0, (s as any).poisonDps ?? 0);
            const poisonDur = Math.max(0, (s as any).poisonDur ?? 0);

            const p = spawnProjectile(w, {
                kind: PRJ_KIND.SYRINGE,
                x: w.px,
                y: w.py,
                dirX: aim.x,
                dirY: aim.y,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: 999, // for now
                ttl: ttlSafety,
                maxDist,
            });

            // Attach poison payload (arrays must exist + be default-pushed on spawn)
            (w as any).prPoisonDps[p] = poisonDps;
            (w as any).prPoisonDur[p] = poisonDur;
        },
    },
    BOUNCER: {
        id: "BOUNCER",
        title: "Bouncer",
        getStats: (level, w) => {
            const lv = clampLevel(level);

            const cooldownBase = 0.25;

            const dmgBase = 7;
            const dmgPer = 2.2;

            // Gains bounces as it levels:
            // Lv1 -> 0 bounces (dies on first hit)
            // Lv2 -> 1 bounce, ... Lv10 -> 9 bounces
            const bounces = Math.max(0, lv - 1)+10;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 560,
                projectileRadius: 6,
                damage: (dmgBase + (lv - 1) * dmgPer) * w.dmgMult,

                // We don't want to pierce to be the limiter for this weapon.
                // Ricochet rules control lifetime.
                pierce: 999,

                // stash bounces as an escape hatch
                ...( { bounces } as any ),
            } as any;
        },

        fire: (w, s, aim) => {
            const viewW = (w as any).viewW ?? 800;

            // Give it enough life to bounce around.
            // (It will still die early if it runs out of bounces and hits again.)
            const ttlSafety = 6.0;

            const bounces = Math.max(0, ((s as any).bounces ?? 0));

            spawnProjectile(w, {
                kind: PRJ_KIND.BOUNCER,
                x: w.px,
                y: w.py,
                dirX: aim.x,
                dirY: aim.y,
                speed: s.projectileSpeed,
                damage: s.damage,
                radius: s.projectileRadius,
                pierce: 999,
                ttl: ttlSafety,

                // IMPORTANT: enables the ricochet path
                bounces,
            });
        },
    },
    BOUNCER_EVOLVED_BANKSHOT: {
        id: "BOUNCER_EVOLVED_BANKSHOT",
        title: "Bankshot",
        hiddenFromPools: true,
        evolvedFrom: "BOUNCER",

        // DEBUG: number of firing directions
        // 1 = aim direction
        // 2 = north + south
        // 4 = north, east, south, west
        // 8 = includes diagonals

        // @ts-ignore — debug-only extra field
        directions: 1,

        getStats: (level, w) => {
            const cooldownBase = 0.2;

            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: 620,
                projectileRadius: 7,
                damage: 5 * w.dmgMult,
                pierce: 999,

                ...( { bounces: 10, wallBounce: true } as any ),
            } as any;
        },

        fire: (w, s, aim) => {
            const ttlSafety = 10.0;
            const bounces = 10;

            // 👇 read directly from weapon def (debug only)
            const dirs = (WEAPONS as any).BOUNCER_EVOLVED_BANKSHOT.directions ?? 1;

            // Single-direction fallback (normal aimed shot)
            if (dirs === 1) {
                spawnProjectile(w, {
                    kind: PRJ_KIND.BOUNCER,
                    x: w.px,
                    y: w.py,
                    dirX: aim.x,
                    dirY: aim.y,
                    speed: s.projectileSpeed,
                    damage: s.damage,
                    radius: s.projectileRadius,
                    pierce: 999,
                    ttl: ttlSafety,
                    bounces,
                    wallBounce: true,
                });
                return;
            }

            const step = (Math.PI * 2) / dirs;

            for (let i = 0; i < dirs; i++) {
                const a = i * step;

                // 0 = north
                const dx = Math.cos(a - Math.PI / 2);
                const dy = Math.sin(a - Math.PI / 2);

                spawnProjectile(w, {
                    kind: PRJ_KIND.PISTOL,
                    x: w.px,
                    y: w.py,
                    dirX: dx,
                    dirY: dy,
                    speed: s.projectileSpeed,
                    damage: s.damage,
                    radius: s.projectileRadius,
                    pierce: 999,
                    ttl: ttlSafety,
                    bounces,
                    wallBounce: true,
                });
            }
        },
    },
    BAZOOKA: {
        id: "BAZOOKA",
        title: "Bazooka",

        getStats: (level: number, w: World) => {
            const lv = clampLevel(level);

            const cooldownBase = 1;

            // Rocket travel speed (world units/sec)
            const rocketSpeedBase = 150;
            const rocketSpeedPer = 18;

            // Explosion radius (scales with AREA)
            const blastBase = 86;
            const blastPer = 6.5;
            const blastR = (blastBase + (lv - 1) * blastPer) * (w.areaMult ?? 1);

            // Explosion damage (scales with DMG)
            const dmgBase = 34;
            const dmgPer = 3.1;
            const dmg = (dmgBase + (lv - 1) * dmgPer) * (w.dmgMult ?? 1);

            // Targeting radius around player (acquisition range)
            const targetRadiusBase = 420;
            const targetRadiusPer = 12;
            const targetRadius = targetRadiusBase + (lv - 1) * targetRadiusPer;

            // Rocket collision radius (visual/feel)
            const rocketR = 7;

            return {
                cooldown: cooldownBase / (w.fireRateMult ?? 1),
                projectileSpeed: rocketSpeedBase + (lv - 1) * rocketSpeedPer,

                // IMPORTANT:
                // We keep projectileRadius = blast radius for convenience (your original pattern),
                // and use rocketR as the actual rocket collision radius.
                projectileRadius: blastR,
                damage: dmg,

                // Bazooka uses CLUSTER targeting to hit groups of enemies
                targeting: "CLUSTER" as TargetingStrategy,
                targetingRange: targetRadius,
                clusterRadius: blastR, // cluster radius matches blast radius

                // escape hatch fields for fire()
                ...({ targetRadius, rocketR } as any),
            } as any;
        },

        fire: (w: World, s: any, aim: Aim): void => {
            const targetRadius = (s as any).targetRadius ?? 420;
            const rocketR = (s as any).rocketR ?? 7;
            const blastR = s.projectileRadius ?? 86;

            // Use the targeting system to find the best cluster
            const target = findTarget(w, "CLUSTER", targetRadius, blastR);

            // Pick a target point
            let tx: number;
            let ty: number;

            if (target.enemyIndex !== -1) {
                // Use the cluster centroid (not just the enemy position)
                tx = target.x;
                ty = target.y;
            } else {
                // fallback: fire forward
                tx = w.px + aim.x * targetRadius;
                ty = w.py + aim.y * targetRadius;
            }

            // Direction toward target point
            let dx = tx - w.px;
            let dy = ty - w.py;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;

            const speed = s.projectileSpeed;

            // TTL long enough to cross acquisition radius + buffer
            const dist = Math.hypot(tx - w.px, ty - w.py);
            const ttl = Math.max(0.35, dist / Math.max(1, speed) + 0.45);

            // Optional: keep impact damage smaller so explosion is the identity (prevents double-dipping)
            const impactDmg = Math.max(1, (s.damage ?? 0) * 0.25);

            // Spawn rocket (collides normally). Explosion is triggered by collisionsSystem using payload arrays.
            const p = spawnProjectile(w, {
                kind: PRJ_KIND.BAZOOKA, // keep your bazooka visual kind if it exists in your project
                x: w.px,
                y: w.py,
                dirX: dx,
                dirY: dy,
                speed,
                damage: impactDmg,
                radius: rocketR,
                pierce: 999, // we kill it ourselves on first hit when explosion triggers
                ttl,
                maxDist: (w as any).viewW ? (w as any).viewW * 2 : undefined,
            });

            // Attach explode-on-hit payload
            (w as any).prExplodeR[p] = Math.max(1, s.projectileRadius ?? 0); // blast radius
            (w as any).prExplodeDmg[p] = Math.max(0, s.damage ?? 0);         // explosion damage
            (w as any).prExplodeTtl[p] = 0.30;                               // VFX ring duration
        },
    },
    BAZOOKA_EVOLVED: {
        id: "BAZOOKA_EVOLVED",
        title: "Bazooka evolved",
        hiddenFromPools: true,
        evolvedFrom: "BAZOOKA",

        getStats: (level: number, w: World) => {
            const lv = clampLevel(level);

            const cooldownBase = 5;

            // Rocket travel speed (world units/sec)
            const rocketSpeedBase = 150;
            const rocketSpeedPer = 18;

            // Explosion radius (scales with AREA)
            const blastBase = 100;
            const blastPer = 6.5;
            const blastR = (blastBase + (lv - 1) * blastPer) * (w.areaMult ?? 1);

            // Explosion damage (scales with DMG)
            const dmgBase = 34;
            const dmgPer = 3.1;
            const dmg = (dmgBase + (lv - 1) * dmgPer) * (w.dmgMult ?? 1);

            // Targeting radius around player (acquisition range)
            const targetRadiusBase = 420;
            const targetRadiusPer = 12;
            const targetRadius = targetRadiusBase + (lv - 1) * targetRadiusPer;

            // Rocket collision radius (visual/feel)
            const rocketR = 7;

            return {
                cooldown: cooldownBase / (w.fireRateMult ?? 1),
                projectileSpeed: rocketSpeedBase + (lv - 1) * rocketSpeedPer,

                // IMPORTANT:
                // We keep projectileRadius = blast radius for convenience (your original pattern),
                // and use rocketR as the actual rocket collision radius.
                projectileRadius: blastR,
                damage: dmg,

                // Bazooka evolved also uses CLUSTER targeting
                targeting: "CLUSTER" as TargetingStrategy,
                targetingRange: targetRadius,
                clusterRadius: blastR,

                // escape hatch fields for fire()
                ...({ targetRadius, rocketR } as any),
            } as any;
        },

        fire: (w: World, s: any, aim: Aim): void => {
            const targetRadius = (s as any).targetRadius ?? 420;
            const rocketR = (s as any).rocketR ?? 7;
            const blastR = s.projectileRadius ?? 100;

            // Use the targeting system to find the best cluster
            const target = findTarget(w, "CLUSTER", targetRadius, blastR);

            // Pick a target point
            let tx: number;
            let ty: number;

            if (target.enemyIndex !== -1) {
                // Use the cluster centroid (not just the enemy position)
                tx = target.x;
                ty = target.y;
            } else {
                // fallback: fire forward
                tx = w.px + aim.x * targetRadius;
                ty = w.py + aim.y * targetRadius;
            }

            // Direction toward target point
            let dx = tx - w.px;
            let dy = ty - w.py;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;

            const speed = s.projectileSpeed;

            // TTL long enough to cross acquisition radius + buffer
            const dist = Math.hypot(tx - w.px, ty - w.py);
            const ttl = Math.max(0.35, dist / Math.max(1, speed) + 0.45);

            // Optional: keep impact damage smaller so explosion is the identity (prevents double-dipping)
            const impactDmg = Math.max(1, (s.damage ?? 0) * 0.25);

            // Spawn rocket (collides normally). Explosion is triggered by collisionsSystem using payload arrays.
            const p = spawnProjectile(w, {
                kind: PRJ_KIND.BAZOOKA, // keep your bazooka visual kind if it exists in your project
                x: w.px,
                y: w.py,
                dirX: dx,
                dirY: dy,
                speed,
                damage: impactDmg,
                radius: rocketR,
                pierce: 999, // we kill it ourselves on first hit when explosion triggers
                ttl,
                maxDist: (w as any).viewW ? (w as any).viewW * 2 : undefined,
            });

            // Attach explode-on-hit payload
            (w as any).prExplodeR[p] = Math.max(1, s.projectileRadius ?? 0); // blast radius
            (w as any).prExplodeDmg[p] = Math.max(0, s.damage ?? 0);         // explosion damage
            (w as any).prExplodeTtl[p] = 0.25;                               // VFX ring duration

            // NEW: evolution aftershocks (N delayed explosions in a ring)
            (w as any).prAftershockN[p] = 3;               // N (tune)
            (w as any).prAftershockDelay[p] = 0.85 * (w.durationMult ?? 1);        // seconds after initial explosion
            (w as any).prAftershockRingR[p] = 200 * (w.areaMult ?? 1); // ring radius scales w/ area
            (w as any).prAftershockWaves[p] = 3; // Wave count tune
            (w as any).prAftershockRingStep[p] = 60 * (w.areaMult ?? 1);   // ring spacing
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


    // --- Orbit weapon: Brass Knuckles / "Knuckle Ring" ---
    KNUCKLES: {
        id: "KNUCKLES",
        title: "Knuckle Ring",
        getStats: (level, w) => {
            const lv = clampLevel(level);

            const dmgBase = 9;
            const dmgPer = 1.4;

            const orbitBaseRadius = 42 + (lv - 1) * 5.5;
            const orbitBaseAngVel = 6.5;

            // === UPTIME MODEL ===
            // Baseline: 2s up, 2s down => 50% uptime with no buffs
            const BASE_DURATION = 2.0; // seconds alive
            const BASE_COOLDOWN = 4.0; // seconds between spawns

            // Fire rate scales ONLY how often we spawn (uptime)
            const cooldown = BASE_COOLDOWN / w.fireRateMult;

            // Projectile count scales with WEAPON LEVEL (density), not fire rate
            // Lv1 -> 2, Lv2 -> 3, ... Lv10 -> 11 (tune later if needed)
            const projectileCount = Math.max(2, 2 + (lv - 1));

            return {
                cooldown,
                projectileSpeed: 0,
                projectileRadius: 9,
                damage: (dmgBase + (lv - 1) * dmgPer) * w.dmgMult,
                pierce: 999,

                // Duration scales with DURATION items
                duration: BASE_DURATION * w.durationMult,

                orbitBaseRadius,
                orbitBaseAngVel,

                projectileCount,
            };
        },

        fire: (w, s, _aim) => {
            // Maintain ring: ensure we have exactly N orbitals alive.
            const target = Math.max(2, s.projectileCount ?? 2);

            // Count current alive knuckles
            let alive = 0;
            for (let i = 0; i < w.pAlive.length; i++) {
                if (!w.pAlive[i]) continue;
                if (w.prjKind[i] !== PRJ_KIND.KNUCKLES) continue;
                alive++;
            }

            const missing = target - alive;
            if (missing <= 0) return;

            // Spawn ALL at once, evenly spaced to maximize distance.
            // To guarantee perfect spacing (and avoid clumping when target changes),
            // we re-seed the entire ring whenever we detect missing orbitals.
            for (let i = 0; i < w.pAlive.length; i++) {
                if (!w.pAlive[i]) continue;
                if (w.prjKind[i] !== PRJ_KIND.KNUCKLES) continue;
                w.pAlive[i] = false;
            }

            // Optional: keep a slowly rotating phase so it doesn’t look “locked”
            const phaseKey = "_knuckleRingPhase";
            let phase = (w as any)[phaseKey] as number | undefined;
            if (typeof phase !== "number" || !isFinite(phase)) phase = 0;

            // small phase drift so ring doesn't always align same axes
            phase += 0.15;
            (w as any)[phaseKey] = phase;

            for (let k = 0; k < target; k++) {
                const ang = phase + (k / target) * Math.PI * 2;

                spawnKnucklesOrbital(w, {
                    x: w.px,
                    y: w.py,
                    dirX: 1,
                    dirY: 0,
                    speed: 0,
                    damage: s.damage,
                    radius: s.projectileRadius,
                    pierce: s.pierce ?? 999,

                    // Orbitals live for the intended duration (default 2s * durationMult)
                    ttl: s.duration ?? 2.0,

                    orbAngle: ang,
                    orbBaseRadius: s.orbitBaseRadius ?? 40,
                    orbBaseAngVel: s.orbitBaseAngVel ?? 6.0,
                });
            }
        },
    },
    AURA: {
        id: "AURA",
        title: "Intimidation Aura",
        getStats: (level, w) => {
            const lv = clampLevel(level);

            // Tick fairly often; damage per tick is modest.
            const cooldownBase = 0.25;

            const baseRadius = 55;
            const radiusPer = 4.5;

            const dmgBase = 4.0;
            const dmgPer = 1.1;

            // Area scales with areaMult, damage scales with dmgMult.
            const radius = (baseRadius + (lv - 1) * radiusPer) * (w.areaMult ?? 1);
            const damagePerTick = (dmgBase + (lv - 1) * dmgPer) * w.dmgMult;

            return {
                cooldown: cooldownBase / w.fireRateMult,

                // We reuse existing fields so we don’t have to redesign WeaponStats right now:
                projectileSpeed: 0,
                projectileRadius: radius,
                damage: damagePerTick,
                pierce: 999,
            };
        },
        fire: (w, s, _aim) => {
            // Keep EXACTLY ONE aura zone alive and just update it.
            const key = "_auraZoneIdx";
            const existing = (w as any)[key] as number | undefined;

            const radius = s.projectileRadius;
            const dmg = s.damage;

            if (existing !== undefined && w.zAlive[existing]) {
                w.zKind[existing] = ZONE_KIND.AURA;
                w.zFollowPlayer[existing] = true;

                w.zx[existing] = w.px;
                w.zy[existing] = w.py;

                w.zR[existing] = radius;
                w.zDamage[existing] = dmg;

                // Tick settings: aura should feel continuous
                w.zTickEvery[existing] = 0.20;
                // Don’t fully reset tickLeft each refresh; keep it “smooth”.
                w.zTickLeft[existing] = Math.min(w.zTickLeft[existing], w.zTickEvery[existing]);

                w.zTtl[existing] = Infinity;
                return;
            }

            const idx = spawnZone(w, {
                kind: ZONE_KIND.AURA,
                x: w.px,
                y: w.py,
                radius,
                damage: dmg,
                tickEvery: 0.20,
                ttl: Infinity,
                followPlayer: true,
            });

            (w as any)[key] = idx;
        },
    },


    MOLOTOV: {
        id: "MOLOTOV",
        title: "Molotov Cocktail",

        getStats: (level, w) => {
            const lv = clampLevel(level);

            // How often you throw a molotov (separate from burn tick rate)
            const cooldownBase = 2.35;

            // Fire puddle radius (scales with AREA multiplier)
            const baseRadius = 62;
            const radiusPer = 5.5;
            const radius = (baseRadius + (lv - 1) * radiusPer) * (w.areaMult ?? 1);

            // Damage is "damage per tick" (scales with DMG multiplier)
            const dmgBase = 6.0;
            const dmgPer = 1.15;
            const dmgPerTick = (dmgBase + (lv - 1) * dmgPer) * w.dmgMult;

            // Throw distance along aim (feel-tuning; not part of your item multipliers)
            const baseThrow = 190;
            const throwPer = 10;
            const throwDist = baseThrow + (lv - 1) * throwPer;

            // Duration scales with DURATION item multiplier
            const baseDuration = 3.6 + (lv - 1) * 0.18;
            const duration = baseDuration * (w.durationMult ?? 1);

            // Tick rate scales with FIRE_RATE (this is the "hit rate" you asked for)
            const baseTickEvery = 0.28;
            const tickEvery = Math.max(0.08, baseTickEvery / (w.fireRateMult ?? 1));

            // We reuse existing WeaponStats fields:
            // - projectileSpeed = throw distance
            // - projectileRadius = puddle radius
            // - damage = damage per tick
            return {
                cooldown: cooldownBase / w.fireRateMult,
                projectileSpeed: throwDist,
                projectileRadius: radius,
                damage: dmgPerTick,

                // Molotov uses CLUSTER targeting to throw at groups of enemies
                targeting: "CLUSTER" as TargetingStrategy,
                targetingRange: throwDist + 50, // slightly larger than throw distance
                clusterRadius: radius, // cluster radius matches puddle radius

                // use duration field even though it isn't an orbital here
                duration,
                // optional: stash tickEvery using a private field so fire() can read it
                // (WeaponStats has no tickEvery field, so we attach it as an escape hatch)
                ...( { tickEvery } as any ),
            } as any;
        },

        fire: (w, s, aim) => {
            const throwDist = s.projectileSpeed;
            const radius = s.projectileRadius ?? 62;

            // Use targeting to find the best cluster within throw range
            const target = findTarget(w, "CLUSTER", throwDist + 50, radius);

            let x: number;
            let y: number;

            if (target.enemyIndex !== -1) {
                // Throw at the cluster centroid, but clamp to throw distance
                const dx = target.x - w.px;
                const dy = target.y - w.py;
                const dist = Math.hypot(dx, dy);
                
                if (dist <= throwDist) {
                    x = target.x;
                    y = target.y;
                } else {
                    // Clamp to max throw distance
                    x = w.px + (dx / dist) * throwDist;
                    y = w.py + (dy / dist) * throwDist;
                }
            } else {
                // Fallback: throw in aim direction
                x = w.px + aim.x * throwDist;
                y = w.py + aim.y * throwDist;
            }

            // Pull tickEvery back out (stored in stats as an escape hatch)
            const tickEvery = Math.max(0.08, ((s as any).tickEvery ?? 0.28));

            const z = spawnZone(w, {
                kind: ZONE_KIND.FIRE,
                x,
                y,
                radius: s.projectileRadius,
                damage: s.damage,
                tickEvery,
                ttl: s.duration ?? 3.5,
                followPlayer: false,
            });

            // Make it feel “impactful”: apply first tick immediately
            w.zTickLeft[z] = 0;
        },
    },
};
