// src/game/stats/derivedStats.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { getRelicMods } from "../systems/progression/relics";

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
    if (w.relics.includes("PASS_DAMAGE_PERCENT_20")) w.dmgMult *= 1.2;
    if (w.relics.includes("PASS_LIFE_TO_DAMAGE_2P")) {
        const bonus = w.playerHpMax * 0.2;
        w.dmgMult *= 1 + bonus / BASE_DAMAGE_REFERENCE;
    }
    if (w.relics.includes("ARMOR_MAX_50")) w.maxArmor += 50;
    const hasArmorDoubleMax = w.relics.includes("ARMOR_DOUBLE_MAX");
    if (hasArmorDoubleMax) w.maxArmor *= 2;
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
