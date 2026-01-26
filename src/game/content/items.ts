import type { World } from "../world";

export type ItemId = "DMG" | "FIRE_RATE" | "MOVE_SPEED" | "PICKUP_RADIUS";

export const MAX_ITEM_LEVEL = 10;

export type ItemDef = {
    id: ItemId;
    title: string;
    desc: string;

    /** Apply this item's effect at a given level into derived stats (mutate world stats). */
    apply: (w: World, level: number) => void;
};

export const ITEMS: Record<ItemId, ItemDef> = {
    DMG: {
        id: "DMG",
        title: "Damage",
        desc: "All weapon damage increases.",
        apply: (w, level) => {
            // multiplicative scaling
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            // +15% per level (tune later)
            w.dmgMult *= Math.pow(1.15, lv);
        },
    },

    FIRE_RATE: {
        id: "FIRE_RATE",
        title: "Fire Rate",
        desc: "Weapons fire more often.",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            w.fireRateMult *= Math.pow(1.12, lv);
        },
    },

    MOVE_SPEED: {
        id: "MOVE_SPEED",
        title: "Move Speed",
        desc: "Run faster. Live longer.",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            w.pSpeed += 18 * lv;
        },
    },

    PICKUP_RADIUS: {
        id: "PICKUP_RADIUS",
        title: "Pickup Radius",
        desc: "Vacuum XP from farther away.",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            w.pickupRadius += 18 * lv;
        },
    },
};
