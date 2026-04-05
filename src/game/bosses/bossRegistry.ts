import { BOSS_ABILITIES, type BossAbilityDefinition } from "./bossAbilities";
import { BOSSES } from "./bossDefinitions";
import type { BossDefinition, BossId } from "./bossTypes";

export const bossRegistry = {
  bossIds(): BossId[] {
    return Object.keys(BOSSES) as BossId[];
  },
  boss(id: BossId): BossDefinition {
    const def = BOSSES[id];
    if (!def) throw new Error(`Unknown boss id: ${id}`);
    return def;
  },
  ability(id: string): BossAbilityDefinition {
    const def = BOSS_ABILITIES[id as keyof typeof BOSS_ABILITIES];
    if (!def) throw new Error(`Unknown boss ability id: ${id}`);
    return def;
  },
} as const;
