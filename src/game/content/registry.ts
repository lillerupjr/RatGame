// src/game/content/registry.ts
import { WEAPONS, type WeaponDef, type WeaponId, MAX_WEAPON_LEVEL } from "./weapons";
import { ITEMS, type ItemDef, type ItemId, MAX_ITEM_LEVEL } from "./items";
import { stageDocks, type StageDef } from "./stages";
import { ENEMIES, type EnemyDef, type EnemyType } from "./enemies";
import { PRJ_KIND, type ProjectileSource } from "../factories/projectileFactory";

export const registry = {
    // ---- Weapons ----
    weaponIds(): WeaponId[] {
        const ids = Object.keys(WEAPONS) as WeaponId[];
        return ids.filter((id) => !WEAPONS[id]?.hiddenFromPools);
    },
    weapon(id: WeaponId): WeaponDef {
        const def = WEAPONS[id];
        if (!def) throw new Error(`Unknown weapon id: ${id}`);
        return def;
    },
    maxWeaponLevel(): number {
        return MAX_WEAPON_LEVEL;
    },

    // ---- Projectiles ----
    projectileSourceFromKind(kind: number): ProjectileSource {
        switch (kind) {
            case PRJ_KIND.KNIFE:
                return "KNIFE";
            case PRJ_KIND.PISTOL:
                return "PISTOL";
            case PRJ_KIND.SWORD:
                return "SWORD";
            default:
                return "OTHER";
        }
    },

    // ---- Items ----
    itemIds(): ItemId[] {
        return Object.keys(ITEMS) as ItemId[];
    },
    item(id: ItemId): ItemDef {
        const def = ITEMS[id];
        if (!def) throw new Error(`Unknown item id: ${id}`);
        return def;
    },
    maxItemLevel(): number {
        return MAX_ITEM_LEVEL;
    },

    // ---- Enemies ----
    enemyTypeIds(): EnemyType[] {
        return Object.keys(ENEMIES).map((k) => Number(k) as EnemyType);
    },
    enemy(type: EnemyType): EnemyDef {
        const def = ENEMIES[type];
        if (!def) throw new Error(`Unknown enemy type: ${type}`);
        return def;
    },

    // ---- Stages ----
    stage(id: "DOCKS"): StageDef {
        switch (id) {
            case "DOCKS":
                return stageDocks;
            default:
                throw new Error(`Unknown stage id: ${id satisfies never}`);
        }
    },
} as const;
