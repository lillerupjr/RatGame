// src/game/stats/derivedStats.ts
import type { World } from "../../engine/world/world";
import { registry } from "../content/registry";
import { getRelicMods } from "../systems/progression/relics";
import { getCardById } from "../combat_mods/content/cards/cardPool";
import { STAT_KEYS } from "../combat_mods/stats/statKeys";
import { resolveScalarPipeline } from "./playerStatPipeline";

const BASE_DAMAGE_REFERENCE = 100;

/**
 * Recompute all derived stats from base stats + current items.
 * This should be the ONLY place that knows how items affect derived stats.
 */


export function recomputeDerivedStats(w: World) {
    const prevCurrentArmor = Number.isFinite(w.currentArmor) ? w.currentArmor : 0;
    const relicIds = Array.isArray(w.relics) ? w.relics : [];
    const hasRelic = (id: string): boolean => relicIds.includes(id);
    const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);

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

    // Capture item contributions before rebuilding pipeline-driven globals.
    const itemDamageMoreFactor = Math.max(0, finite(w.dmgMult, 1));
    const itemAttackSpeedMoreFactor = Math.max(0, finite(w.fireRateMult, 1));
    const itemMoveSpeedFlat = finite(w.pSpeed, w.baseMoveSpeed) - w.baseMoveSpeed;

    // Rebuild these outputs from the contract pipeline below.
    w.dmgMult = 1;
    w.fireRateMult = 1;
    w.pSpeed = w.baseMoveSpeed;

    const relicMods = getRelicMods(w);

    if (hasRelic("ARMOR_MAX_50")) w.maxArmor += 50;
    w.maxArmor += relicMods.flatMaxArmor ?? 0;
    const hasArmorDoubleMax = hasRelic("ARMOR_DOUBLE_MAX");
    if (hasArmorDoubleMax) w.maxArmor *= 2;

    // Apply card defense mods (LIFE_ADD)
    let cardLifeAdd = 0;
    for (const cardId of w.cards) {
        const def = getCardById(cardId);
        if (!def) continue;
        for (const mod of def.mods) {
            if (mod.key === STAT_KEYS.LIFE_ADD && mod.op === "add") cardLifeAdd += mod.value;
        }
    }

    const hpFlatAdds = cardLifeAdd >= 0 ? [cardLifeAdd] : [];
    const hpFlatSubs = cardLifeAdd < 0 ? [-cardLifeAdd] : [];
    const hpLess: number[] = [];
    if (hasRelic("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50")) hpLess.push(0.5);
    w.playerHpMax = resolveScalarPipeline({
        base: finite(w.basePlayerHpMax, 0),
        flatAdds: hpFlatAdds,
        flatSubs: hpFlatSubs,
        increased: [],
        decreased: [],
        more: [],
        less: hpLess,
        min: 1,
        rounding: "floor",
    });

    if (hasRelic("MOM_MAX_MOMENTUM_PLUS_10")) w.momentumMax += 10;
    w.momentumMax = Math.max(0, w.momentumMax);
    w.momentumValue = Math.max(0, Math.min(w.momentumMax, Number.isFinite(w.momentumValue) ? w.momentumValue : 0));
    const momentum = Math.max(0, Math.min(w.momentumMax, finite(w.momentumValue, 0)));

    const damageMore: number[] = [];
    const damageLess: number[] = [];
    if (itemDamageMoreFactor !== 1) damageMore.push(itemDamageMoreFactor - 1);
    if (hasRelic("PASS_DAMAGE_PERCENT_20")) damageMore.push(0.2);
    if (hasRelic("SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40")) damageMore.push(1.0);
    if (hasRelic("SPEC_DAMAGE_MORE_200_MAX_LIFE_LESS_50")) damageMore.push(2.0);
    if (hasRelic("PASS_LIFE_TO_DAMAGE_2P")) {
        const lifeToDamageMore = (w.playerHpMax * 0.2) / BASE_DAMAGE_REFERENCE;
        if (lifeToDamageMore !== 0) damageMore.push(lifeToDamageMore);
    }
    if (hasRelic("MOM_DAMAGE_PER_MOMENTUM_5")) damageMore.push(0.03 * momentum);
    if (hasRelic("SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30")) damageLess.push(0.3);
    if (hasRelic("SPEC_DOT_SPECIALIST")) damageLess.push(0.5);
    w.dmgMult = resolveScalarPipeline({
        base: 1,
        flatAdds: [],
        flatSubs: [],
        increased: [],
        decreased: [],
        more: damageMore,
        less: damageLess,
        min: 0,
        rounding: "none",
    });

    const attackSpeedMore: number[] = [];
    const attackSpeedLess: number[] = [];
    if (itemAttackSpeedMoreFactor !== 1) attackSpeedMore.push(itemAttackSpeedMoreFactor - 1);
    if (hasRelic("SPEC_ATTACK_SPEED_MORE_50_DAMAGE_LESS_30")) attackSpeedMore.push(0.5);
    if (hasRelic("SPEC_DAMAGE_MORE_100_ATTACK_SPEED_LESS_40")) attackSpeedLess.push(0.3);
    w.fireRateMult = resolveScalarPipeline({
        base: 1,
        flatAdds: [],
        flatSubs: [],
        increased: [],
        decreased: [],
        more: attackSpeedMore,
        less: attackSpeedLess,
        min: 0,
        rounding: "none",
    });

    const moveFlatAdds = itemMoveSpeedFlat >= 0 ? [itemMoveSpeedFlat] : [];
    const moveFlatSubs = itemMoveSpeedFlat < 0 ? [-itemMoveSpeedFlat] : [];
    const moveIncreased: number[] = [];
    const moveMore: number[] = [];
    const moveLess: number[] = [];
    if (hasRelic("MOM_MOVE_SPEED_PER_MOMENTUM_3")) moveIncreased.push(0.02 * momentum);
    if (hasRelic("PASS_MOVE_SPEED_20")) moveMore.push(0.2);
    if (hasRelic("SPEC_FLAT_ARMOR_100_MOVE_SPEED_LESS_20")) moveLess.push(0.2);
    w.pSpeed = resolveScalarPipeline({
        base: finite(w.baseMoveSpeed, 0),
        flatAdds: moveFlatAdds,
        flatSubs: moveFlatSubs,
        increased: moveIncreased,
        decreased: [],
        more: moveMore,
        less: moveLess,
        min: 0,
        rounding: "none",
    });

    // Recompute can only lower current HP.
    w.playerHp = Math.min(w.playerHp, w.playerHpMax);

    w.currentArmor = prevCurrentArmor;
    w.maxArmor = Math.max(0, w.maxArmor);
    w.currentArmor = Math.max(0, Math.min(w.maxArmor, w.currentArmor));
}
