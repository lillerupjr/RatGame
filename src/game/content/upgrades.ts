// src/game/content/upgrades.ts
import type { World } from "../world";
import { recomputeDerivedStats } from "../world";
import { registry } from "./registry";
import type { WeaponId } from "./weapons";
import type { ItemId } from "./items";

export type UpgradeDef = {
    id: string;
    title: string;
    desc: string;

    /** If false, upgrade is not in loot pool. */
    isAvailable: (w: World) => boolean;

    /** Apply one pick of this upgrade. */
    apply: (w: World) => void;

    /** Optional: show current rank/level. */
    getRankText?: (w: World) => string;
};

const MAX_WEAPON_SLOTS = 4;
const MAX_ITEM_SLOTS = 4;

function ownedWeaponSet(w: World) {
    return new Set(w.weapons.map((x) => x.id));
}
function getWeaponInst(w: World, id: WeaponId) {
    return w.weapons.find((x) => x.id === id);
}

function ownedItemSet(w: World) {
    return new Set(w.items.map((x) => x.id));
}
function getItemInst(w: World, id: ItemId) {
    return w.items.find((x) => x.id === id);
}

/** Build all upgrades. New weapons/items auto-appear by adding to their registries. */
function buildAllUpgrades(): UpgradeDef[] {
    const defs: UpgradeDef[] = [];

    const MAX_WPN = registry.maxWeaponLevel();
    const MAX_ITEM = registry.maxItemLevel();

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
            isAvailable: (w) => w.weapons.length < MAX_WEAPON_SLOTS && !ownedWeaponSet(w).has(id),
            apply: (w) => {
                w.weapons.push({ id, level: 1, cdLeft: 0 });
            },
            getRankText: (_w) => `Lv 1/${MAX_WPN}`,
        });
    }

    for (const id of weaponIds) {
        const wpn = registry.weapon(id);
        defs.push({
            id: `WPN_LV_${id}`,
            title: `${wpn.title} +1`,
            desc: `Increase weapon level. (Evolution at Lv ${MAX_WPN} later.)`,
            isAvailable: (w) => {
                const inst = getWeaponInst(w, id);
                return !!inst && inst.level < MAX_WPN;
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
            isAvailable: (w) => w.items.length < MAX_ITEM_SLOTS && !ownedItemSet(w).has(id),
            apply: (w) => {
                w.items.push({ id, level: 1 });
                recomputeDerivedStats(w);
            },
            getRankText: (_w) => `Lv 1/${MAX_ITEM}`,
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

/** Current loot pool = all upgrades whose isAvailable(world) is true. */
export function getUpgradePool(w: World): UpgradeDef[] {
    const all = buildAllUpgrades();
    return all.filter((u) => u.isAvailable(w));
}
