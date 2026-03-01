// src/game/stats/derivedStats.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { getRelicMods } from "../systems/progression/relics";
import { getCardById } from "../combat_mods/content/cards/cardPool";
import { STAT_KEYS } from "../combat_mods/stats/statKeys";

const BASE_DAMAGE_REFERENCE = 100;

/**
 * Recompute all derived stats from base stats + current items.
 * This should be the ONLY place that knows how items affect derived stats.
 */


export function recomputeDerivedStats(w: World) {
    const prevCurrentArmor = Number.isFinite(w.currentArmor) ? w.currentArmor : 0;

    // Reset derived stats to base
    w.pSpeed = w.baseMoveSpeed;
    w.pickupRadius = w.basePickupRadius;
    w.maxArmor = 50;
    w.momentumMax = 20;

    // Reset multipliers
    w.dmgMult = 1;
    w.fireRateMult = 1;
    w.areaMult = 1;
    w.durationMult = 1;

    // Reset crit bonus (base crit chance stays constant)
    w.critChanceBonus = 0;

    // Apply all items
    for (const inst of w.items) {
        const def = registry.item(inst.id);
        def.apply(w, inst.level);
    }

    const relicMods = getRelicMods(w);
    w.pSpeed *= relicMods.moveSpeedMult ?? 1;
    w.pSpeed *= Math.max(0, 1 - (relicMods.lessMoveSpeed ?? 0));
    if (w.relics.includes("PASS_DAMAGE_PERCENT_20")) w.dmgMult *= 1.2;
    w.dmgMult *= (1 + (relicMods.moreDamage ?? 0));
    w.dmgMult *= Math.max(0, 1 - (relicMods.lessDamage ?? 0));
    w.fireRateMult *= (1 + (relicMods.moreAttackSpeed ?? 0));
    w.fireRateMult *= Math.max(0, 1 - (relicMods.lessAttackSpeed ?? 0));
    if (w.relics.includes("ARMOR_MAX_50")) w.maxArmor += 50;
    w.maxArmor += relicMods.flatMaxArmor ?? 0;
    const hasArmorDoubleMax = w.relics.includes("ARMOR_DOUBLE_MAX");
    if (hasArmorDoubleMax) w.maxArmor *= 2;
    w.playerHpMax = Math.max(1, w.basePlayerHpMax * Math.max(0, 1 - (relicMods.lessMaxLife ?? 0)));

    // Apply card defense mods (LIFE_ADD)
    let cardLifeAdd = 0;
    for (const cardId of w.cards) {
        const def = getCardById(cardId);
        if (!def) continue;
        for (const mod of def.mods) {
            if (mod.key === STAT_KEYS.LIFE_ADD && mod.op === "add") cardLifeAdd += mod.value;
        }
    }
    w.playerHpMax = Math.max(1, w.playerHpMax + cardLifeAdd);

    if (w.relics.includes("PASS_LIFE_TO_DAMAGE_2P")) {
        const bonus = w.playerHpMax * 0.2;
        w.dmgMult *= 1 + bonus / BASE_DAMAGE_REFERENCE;
    }

    w.playerHp = Math.min(w.playerHp, w.playerHpMax);
    if (w.relics.includes("MOM_MAX_MOMENTUM_PLUS_10")) w.momentumMax += 10;
    w.momentumMax = Math.max(0, w.momentumMax);
    w.momentumValue = Math.max(0, Math.min(w.momentumMax, Number.isFinite(w.momentumValue) ? w.momentumValue : 0));
    if (w.relics.includes("MOM_DAMAGE_PER_MOMENTUM_5")) {
        const m = Math.max(0, Math.min(w.momentumMax, Number.isFinite(w.momentumValue) ? w.momentumValue : 0));
        w.dmgMult *= (1 + 0.03 * m);
    }
    if (w.relics.includes("MOM_MOVE_SPEED_PER_MOMENTUM_3")) {
        const m = Math.max(0, Math.min(w.momentumMax, Number.isFinite(w.momentumValue) ? w.momentumValue : 0));
        w.pSpeed += w.baseMoveSpeed * (0.02 * m);
    }

    w.currentArmor = prevCurrentArmor;
    w.maxArmor = Math.max(0, w.maxArmor);
    w.currentArmor = Math.max(0, Math.min(w.maxArmor, w.currentArmor));
}
