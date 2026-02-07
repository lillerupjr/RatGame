// src/game/content/upgrades.ts
import type { World } from "../../engine/world/world";
import { registry } from "./registry";
import type { WeaponId, WeaponStats } from "./weapons";
import type { ItemId } from "./items";
import {recomputeDerivedStats} from "../stats/derivedStats";

/** A single stat change to display in the level-up UI */
export type StatDiff = {
    label: string;
    oldVal: string;
    newVal: string;
    isIncrease: boolean;
};

export type UpgradeDef = {
    id: string;
    title: string;
    desc: string;

    isAvailable: (w: World) => boolean;
    apply: (w: World) => void;

    getRankText?: (w: World) => string;

    /** Return stat changes to display in the level-up UI */
    getStatsDiff?: (w: World) => StatDiff[];

    // Evolutions are forced when available
    isEvolution?: boolean;
};

const MAX_WEAPON_SLOTS = 4;
const MAX_ITEM_SLOTS = 4;

function getWeaponInst(w: World, id: WeaponId) {
    return w.weapons.find((x) => x.id === id);
}

function getItemInst(w: World, id: ItemId) {
    return w.items.find((x) => x.id === id);
}

// Treat "having an evolved weapon" as also owning its base weapon,
// so base weapons don't appear in ADD pool when evolved starter is chosen.
function hasWeaponOrEvolvedFrom(w: World, baseId: WeaponId): boolean {
    if (w.weapons.some((x) => x.id === baseId)) return true;

    for (const inst of w.weapons) {
        const def = registry.weapon(inst.id);
        if ((def as any).evolvedFrom === baseId) return true;
    }
    return false;
}

/** Format a number for display in stat diffs */
function formatStatValue(val: number, decimals: number = 1): string {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(decimals);
}

/** Get weapon stat diffs between current and next level */
function getWeaponStatsDiff(w: World, id: WeaponId): StatDiff[] {
    const inst = getWeaponInst(w, id);
    if (!inst) return [];

    const wpn = registry.weapon(id);
    const currLevel = inst.level;
    const nextLevel = currLevel + 1;

    const currStats = wpn.getStats(currLevel, w);
    const nextStats = wpn.getStats(nextLevel, w);

    const diffs: StatDiff[] = [];

    // Damage
    if (currStats.damage !== nextStats.damage) {
        diffs.push({
            label: "Damage",
            oldVal: formatStatValue(currStats.damage),
            newVal: formatStatValue(nextStats.damage),
            isIncrease: nextStats.damage > currStats.damage,
        });
    }

    // Cooldown (lower is better, so flip isIncrease)
    if (currStats.cooldown !== nextStats.cooldown) {
        diffs.push({
            label: "Cooldown",
            oldVal: formatStatValue(currStats.cooldown, 2) + "s",
            newVal: formatStatValue(nextStats.cooldown, 2) + "s",
            isIncrease: nextStats.cooldown < currStats.cooldown,
        });
    }

    // Projectile count
    if ((currStats.projectileCount ?? 1) !== (nextStats.projectileCount ?? 1)) {
        diffs.push({
            label: "Projectiles",
            oldVal: formatStatValue(currStats.projectileCount ?? 1),
            newVal: formatStatValue(nextStats.projectileCount ?? 1),
            isIncrease: (nextStats.projectileCount ?? 1) > (currStats.projectileCount ?? 1),
        });
    }

    // Pierce
    if ((currStats.pierce ?? 0) !== (nextStats.pierce ?? 0)) {
        diffs.push({
            label: "Pierce",
            oldVal: formatStatValue(currStats.pierce ?? 0),
            newVal: formatStatValue(nextStats.pierce ?? 0),
            isIncrease: (nextStats.pierce ?? 0) > (currStats.pierce ?? 0),
        });
    }

    // Duration (for orbitals etc.)
    if (currStats.duration !== undefined && nextStats.duration !== undefined && currStats.duration !== nextStats.duration) {
        diffs.push({
            label: "Duration",
            oldVal: formatStatValue(currStats.duration) + "s",
            newVal: formatStatValue(nextStats.duration) + "s",
            isIncrease: nextStats.duration > currStats.duration,
        });
    }

    // Fan arc (spread) - show as degrees
    if (currStats.fanArc !== undefined && nextStats.fanArc !== undefined && currStats.fanArc !== nextStats.fanArc) {
        const currDeg = Math.round((currStats.fanArc * 180) / Math.PI);
        const nextDeg = Math.round((nextStats.fanArc * 180) / Math.PI);
        diffs.push({
            label: "Spread",
            oldVal: currDeg + "°",
            newVal: nextDeg + "°",
            isIncrease: nextStats.fanArc > currStats.fanArc,
        });
    }

    // Projectile speed
    if (currStats.projectileSpeed !== nextStats.projectileSpeed) {
        diffs.push({
            label: "Speed",
            oldVal: formatStatValue(currStats.projectileSpeed),
            newVal: formatStatValue(nextStats.projectileSpeed),
            isIncrease: nextStats.projectileSpeed > currStats.projectileSpeed,
        });
    }

    // Area/radius
    if (currStats.projectileRadius !== nextStats.projectileRadius) {
        diffs.push({
            label: "Size",
            oldVal: formatStatValue(currStats.projectileRadius),
            newVal: formatStatValue(nextStats.projectileRadius),
            isIncrease: nextStats.projectileRadius > currStats.projectileRadius,
        });
    }

    return diffs;
}

/** Get item stat diffs - items affect world multipliers */
function getItemStatsDiff(w: World, id: ItemId): StatDiff[] {
    const inst = getItemInst(w, id);
    if (!inst) return [];

    const diffs: StatDiff[] = [];
    const currLevel = inst.level;
    const nextLevel = currLevel + 1;

    switch (id) {
        case "DMG": {
            const currMult = Math.pow(1.15, currLevel);
            const nextMult = Math.pow(1.15, nextLevel);
            diffs.push({
                label: "Damage",
                oldVal: "+" + formatStatValue((currMult - 1) * 100, 0) + "%",
                newVal: "+" + formatStatValue((nextMult - 1) * 100, 0) + "%",
                isIncrease: true,
            });
            break;
        }
        case "FIRE_RATE": {
            const currMult = Math.pow(1.12, currLevel);
            const nextMult = Math.pow(1.12, nextLevel);
            diffs.push({
                label: "Fire Rate",
                oldVal: "+" + formatStatValue((currMult - 1) * 100, 0) + "%",
                newVal: "+" + formatStatValue((nextMult - 1) * 100, 0) + "%",
                isIncrease: true,
            });
            break;
        }
        case "MOVE_SPEED": {
            const currBonus = 18 * currLevel;
            const nextBonus = 18 * nextLevel;
            diffs.push({
                label: "Speed",
                oldVal: "+" + formatStatValue(currBonus),
                newVal: "+" + formatStatValue(nextBonus),
                isIncrease: true,
            });
            break;
        }
        case "PICKUP_RADIUS": {
            const currBonus = 18 * currLevel;
            const nextBonus = 18 * nextLevel;
            diffs.push({
                label: "Radius",
                oldVal: "+" + formatStatValue(currBonus),
                newVal: "+" + formatStatValue(nextBonus),
                isIncrease: true,
            });
            break;
        }
        case "AREA": {
            const currMult = Math.pow(1.10, currLevel);
            const nextMult = Math.pow(1.10, nextLevel);
            diffs.push({
                label: "Area",
                oldVal: "+" + formatStatValue((currMult - 1) * 100, 0) + "%",
                newVal: "+" + formatStatValue((nextMult - 1) * 100, 0) + "%",
                isIncrease: true,
            });
            break;
        }
        case "DURATION": {
            const currMult = Math.pow(1.10, currLevel);
            const nextMult = Math.pow(1.10, nextLevel);
            diffs.push({
                label: "Duration",
                oldVal: "+" + formatStatValue((currMult - 1) * 100, 0) + "%",
                newVal: "+" + formatStatValue((nextMult - 1) * 100, 0) + "%",
                isIncrease: true,
            });
            break;
        }
        case "CRIT_CHANCE": {
            const currBonus = 15 * currLevel;
            const nextBonus = 15 * nextLevel;
            diffs.push({
                label: "Crit Chance",
                oldVal: "+" + formatStatValue(currBonus) + "%",
                newVal: "+" + formatStatValue(nextBonus) + "%",
                isIncrease: true,
            });
            break;
        }
    }

    return diffs;
}

/** Build all upgrades. */
function buildAllUpgrades(): UpgradeDef[] {
    const defs: UpgradeDef[] = [];
    // NEW: evolution unlock level
    const EVOLVE_WPN_LEVEL = 5;
    const MAX_WPN = registry.maxWeaponLevel();
    const MAX_ITEM = registry.maxItemLevel();

    // -----------------------
    // EVOLUTIONS (forced when available)
    // -----------------------

    // Knife evo: requires Knife Lv10 + FIRE_RATE owned
    defs.push({
        id: "EVOLVE_KNIFE_RING",
        title: "Knife Cyclone",
        desc:
            "EVOLUTION: Throwing Knife becomes a 24-knife burst in a full circle. (Requires Throwing Knife Lv 5 + Fire Rate.)",
        isEvolution: true,
        isAvailable: (w) => {
            const knife = getWeaponInst(w, "KNIFE");
            const fireRate = getItemInst(w, "FIRE_RATE");
            return !!knife && knife.level >= EVOLVE_WPN_LEVEL && !!fireRate;
        },
        apply: (w) => {
            const idx = w.weapons.findIndex((x) => x.id === "KNIFE");
            if (idx < 0) return;

            w.weapons[idx] = { id: "KNIFE_EVOLVED_RING", level: 1, cdLeft: 0 };
        },
        getRankText: () => "EVOLUTION",
    });

    // Pistol evo: requires Pistol Lv10 + DMG owned (your choices)
    defs.push({
        id: "EVOLVE_PISTOL_SPIRAL",
        title: "Spiral Viper",
        desc:
            "EVOLUTION: Pistol fires two opposite bullets that rotate clockwise, creating a spiral bullet hell. (Requires Pistol Lv 10 + Damage.)",
        isEvolution: true,
        isAvailable: (w) => {
            const pistol = getWeaponInst(w, "PISTOL");
            const dmg = getItemInst(w, "DMG");
            // You answered: NOT "Lv10 only" -> so Lv10 + DMG is required
            return !!pistol && pistol.level >= EVOLVE_WPN_LEVEL && !!dmg;
        },
        apply: (w) => {
            const idx = w.weapons.findIndex((x) => x.id === "PISTOL");
            if (idx < 0) return;

            w.weapons[idx] = { id: "PISTOL_EVOLVED_SPIRAL", level: 1, cdLeft: 0 };

            // reset spiral angle so it initializes from aim next time it fires
            delete (w as any)._pistolSpiralAng;
        },
        getRankText: () => "EVOLUTION",
    });
// Syringe evo: requires Syringe Lv10 + DURATION owned
    defs.push({
        id: "EVOLVE_SYRINGE_CHAIN",
        title: "Chain Syringe",
        desc:
            "EVOLUTION: Syringe explosions apply poison, allowing chain reactions. (Requires Syringe Lv 10 + Duration.)",
        isEvolution: true,
        isAvailable: (w) => {
            const syringe = getWeaponInst(w, "SYRINGE");
            const duration = getItemInst(w, "DURATION");
            return !!syringe && syringe.level >= EVOLVE_WPN_LEVEL && !!duration;
        },
        apply: (w) => {
            const idx = w.weapons.findIndex((x) => x.id === "SYRINGE");
            if (idx < 0) return;

            w.weapons[idx] = { id: "SYRINGE_EVOLVED_CHAIN", level: 1, cdLeft: 0 };
        },
        getRankText: () => "EVOLUTION",
    });
    // EVOLUTION: Bouncer -> Bankshot
    // Requires: Bouncer Lv 10 + Area owned
    defs.push({
        id: "EVOLVE_BOUNCER_BANKSHOT",
        title: "Bankshot",
        desc:
            "EVOLUTION: Bouncer gains 10 bounces and also ricochets off screen edges. (Requires Bouncer Lv 10 + Area.)",
        isEvolution: true,
        isAvailable: (w) => {
            const bouncer = getWeaponInst(w, "BOUNCER");
            const area = getItemInst(w, "MOVE_SPEED");
            return !!bouncer && bouncer.level >= EVOLVE_WPN_LEVEL && !!area;
        },
        apply: (w) => {
            const idx = w.weapons.findIndex((x) => x.id === "BOUNCER");
            if (idx < 0) return;

            w.weapons[idx] = { id: "BOUNCER_EVOLVED_BANKSHOT", level: 1, cdLeft: 0 };
        },
    });
    // EVOLUTION: Bazooka -> Aftershock
    // Requires: Bazooka Lv 10 + Area owned
    defs.push({
        id: "EVOLVE_BAZOOKA_AFTERSHOCK",
        title: "Aftershock",
        desc:
            "EVOLUTION: Bazooka gains delayed ring aftershocks on impact. (Requires Bazooka Lv 10 + Area.)",
        isEvolution: true,
        isAvailable: (w) => {
            const bazooka = getWeaponInst(w, "BAZOOKA");
            const area = getItemInst(w, "AREA");
            return !!bazooka && bazooka.level >= EVOLVE_WPN_LEVEL && !!area;
        },
        apply: (w) => {
            const idx = w.weapons.findIndex((x) => x.id === "BAZOOKA");
            if (idx < 0) return;

            w.weapons[idx] = { id: "BAZOOKA_EVOLVED", level: 1, cdLeft: 0 };
        },
        getRankText: () => "EVOLUTION",
    });

    // -----------------------
    // Weapons: Add + Level-up
    // -----------------------
    const weaponIds = registry.weaponIds();

    for (const id of weaponIds) {
        const wpn = registry.weapon(id);
        defs.push({
            id: `WPN_ADD_${id}`,
            title: wpn.title,
            desc: `Add weapon. ${wpn.title} joins your loadout.`,
            isAvailable: (w) =>
                w.weapons.length < MAX_WEAPON_SLOTS && !hasWeaponOrEvolvedFrom(w, id),
            apply: (w) => {
                w.weapons.push({ id, level: 1, cdLeft: 0 });
            },
            getRankText: () => `Lv 1/${MAX_WPN}`,
        });
    }

    for (const id of weaponIds) {
        const wpn = registry.weapon(id);
        defs.push({
            id: `WPN_LV_${id}`,
            title: `${wpn.title} +1`,
            desc: `Increase weapon level. (Evolution at Lv ${EVOLVE_WPN_LEVEL}.)`,
            isAvailable: (w) => {
                const inst = getWeaponInst(w, id);
                return !!inst && inst.level < EVOLVE_WPN_LEVEL;
            },
            apply: (w) => {
                const inst = getWeaponInst(w, id);
                if (!inst) return;
                inst.level = Math.min(MAX_WPN, inst.level + 1);
            },
            getRankText: (w) => {
                const inst = getWeaponInst(w, id);
                return inst ? `Lv ${inst.level}/${MAX_WPN}` : "—";
            },
            getStatsDiff: (w) => getWeaponStatsDiff(w, id),
        });
    }

    // -----------------------
    // Items: Add + Level-up
    // -----------------------
    const itemIds = registry.itemIds();

    for (const id of itemIds) {
        const item = registry.item(id);
        defs.push({
            id: `ITEM_ADD_${id}`,
            title: item.title,
            desc: `Add item. ${item.desc}`,
            isAvailable: (w) => w.items.length < MAX_ITEM_SLOTS && !w.items.some((x) => x.id === id),
            apply: (w) => {
                w.items.push({ id, level: 1 });
                recomputeDerivedStats(w);
            },
            getRankText: () => `Lv 1/${MAX_ITEM}`,
        });
    }

    for (const id of itemIds) {
        const item = registry.item(id);
        defs.push({
            id: `ITEM_LV_${id}`,
            title: `${item.title} +1`,
            desc: `Increase item level. ${item.desc}`,
            isAvailable: (w) => {
                const inst = getItemInst(w, id);
                return !!inst && inst.level < MAX_ITEM;
            },
            apply: (w) => {
                const inst = getItemInst(w, id);
                if (!inst) return;
                inst.level = Math.min(MAX_ITEM, inst.level + 1);
                recomputeDerivedStats(w);
            },
            getRankText: (w) => {
                const inst = getItemInst(w, id);
                return inst ? `Lv ${inst.level}/${MAX_ITEM}` : "—";
            },
            getStatsDiff: (w) => getItemStatsDiff(w, id),
        });
    }

    return defs;
}

/** Current loot pool. Forced evolutions override everything else. */
export function getUpgradePool(w: World): UpgradeDef[] {
    const all = buildAllUpgrades();
    const available = all.filter((u) => u.isAvailable(w));

    const evolutions = available.filter((u) => u.isEvolution);
    if (evolutions.length > 0) return evolutions;

    return available;
}
