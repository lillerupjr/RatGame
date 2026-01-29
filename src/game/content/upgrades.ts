// src/game/content/upgrades.ts
import type { World } from "../world";
import { registry } from "./registry";
import type { WeaponId } from "./weapons";
import type { ItemId } from "./items";
import {recomputeDerivedStats} from "../stats/derivedStats";

export type UpgradeDef = {
    id: string;
    title: string;
    desc: string;

    isAvailable: (w: World) => boolean;
    apply: (w: World) => void;

    getRankText?: (w: World) => string;

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
