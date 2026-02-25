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
    // Reset derived stats to base
    w.pSpeed = w.baseMoveSpeed;
    w.pickupRadius = w.basePickupRadius;

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
    w.pSpeed += relicMods.moveSpeedBonus ?? 0;
    if (w.relics.includes("PASS_DAMAGE_PERCENT_20")) w.dmgMult *= 1.2;
    if (w.relics.includes("PASS_LIFE_TO_DAMAGE_2P")) {
        const bonus = w.playerHpMax * 0.2;
        w.dmgMult *= 1 + bonus / BASE_DAMAGE_REFERENCE;
    }
}
