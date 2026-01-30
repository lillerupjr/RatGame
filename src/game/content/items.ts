// src/game/content/items.ts
import type { World } from "../world";

export type ItemId =
    | "DMG"
    | "FIRE_RATE"
    | "MOVE_SPEED"
    | "PICKUP_RADIUS"
    | "AREA"
    | "DURATION"
    | "CRIT_CHANCE";

export const MAX_ITEM_LEVEL = 10;

export type ItemDef = {
    id: ItemId;
    title: string;
    desc: string;
    apply: (w: World, level: number) => void;
};

export const ITEMS: Record<ItemId, ItemDef> = {
    DMG: {
        id: "DMG",
        title: "Damage",
        desc: "All weapon damage increases.",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
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

    AREA: {
        id: "AREA",
        title: "Area",
        desc: "Bigger weapon effects (radius/size).",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            // +10% per level (tune later)
            w.areaMult *= Math.pow(1.10, lv);
        },
    },

    DURATION: {
        id: "DURATION",
        title: "Duration",
        desc: "Effects last longer (orbitals, DoTs, etc.).",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            // +10% per level (tune later)
            w.durationMult *= Math.pow(1.10, lv);
        },
    },

    CRIT_CHANCE: {
        id: "CRIT_CHANCE",
        title: "Lucky Strike",
        desc: "+15% critical hit chance per level.",
        apply: (w, level) => {
            const lv = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.floor(level)));
            // +15% crit chance per level
            w.critChanceBonus += 0.15 * lv;
        },
    },
};
