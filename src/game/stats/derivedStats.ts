// src/game/stats/derivedStats.ts
import type { World } from "../world";
import { ITEMS } from "../content/items";

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

    // Apply all items
    for (const inst of w.items) {
        const def = ITEMS[inst.id];
        def.apply(w, inst.level);
    }
}
