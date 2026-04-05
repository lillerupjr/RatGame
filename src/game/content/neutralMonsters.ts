import { EnemyId } from "./enemies";

export const NEUTRAL_MONSTER_IDS = [EnemyId.LOOT_GOBLIN] as const;

export type NeutralMonsterId = (typeof NEUTRAL_MONSTER_IDS)[number];

export function isNeutralMonsterId(type: EnemyId): type is NeutralMonsterId {
  return type === EnemyId.LOOT_GOBLIN;
}
