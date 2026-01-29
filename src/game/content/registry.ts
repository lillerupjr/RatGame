// src/game/content/registry.ts
import { WEAPONS, type WeaponDef, type WeaponId, MAX_WEAPON_LEVEL } from "./weapons";
import { ITEMS, type ItemDef, type ItemId, MAX_ITEM_LEVEL } from "./items";
import { stageDocks, stageSewers, stageChinatown, type StageDef, type StageId } from "./stages";
import { ENEMIES, type EnemyDef, type EnemyType } from "./enemies";
import { PRJ_KIND, type ProjectileSource } from "../factories/projectileFactory";

export const registry = {
    // ---- Weapons ----
    weaponIds(): WeaponId[] {
        const ids = Object.keys(WEAPONS) as WeaponId[];

        // Base weapons = visible in pools (not hidden)
        const base = ids.filter((id) => !WEAPONS[id]?.hiddenFromPools);

        // Evolvable bases = any weapon that has at least one evolution pointing to it
        const evolvableBases = new Set<WeaponId>();
        for (const wid of ids) {
            const from = WEAPONS[wid]?.evolvedFrom;
            if (from) evolvableBases.add(from);
        }

        // Loot pool should only include weapons that can evolve
        return base.filter((id) => evolvableBases.has(id));
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
            case PRJ_KIND.KNUCKLES:
                return "KNUCKLES";
            case PRJ_KIND.SYRINGE:
                return "SYRINGE";
            case PRJ_KIND.BOUNCER:
                return "BOUNCER";

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
    stage(id: StageId): StageDef {
        switch (id) {
            case "DOCKS":
                return stageDocks;
            case "SEWERS":
                return stageSewers;
            case "CHINATOWN":
                return stageChinatown;
            default:
                throw new Error(`Unknown stage id: ${id satisfies never}`);
        }
    },
} as const;
