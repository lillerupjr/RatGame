import {
  addBleed,
  addPoison,
  applyIgniteStrongestOnly,
  createEnemyAilmentsState,
  type EnemyAilmentsState,
} from "./enemyAilments";

export interface ApplyAilmentsChances {
  bleed: number;
  ignite: number;
  poison: number;
}

export interface ApplyAilmentsDamage {
  physical: number;
  fire: number;
  chaos: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export interface ApplyAilmentsRolls {
  bleed: number;
  ignite: number;
  poison: number;
}

export function ensureEnemyAilmentsAt(
  arr: (EnemyAilmentsState | undefined)[],
  enemyIndex: number
): EnemyAilmentsState {
  if (!arr[enemyIndex]) arr[enemyIndex] = createEnemyAilmentsState();
  return arr[enemyIndex] as EnemyAilmentsState;
}

export function applyAilmentsFromHit(
  state: EnemyAilmentsState,
  dealt: ApplyAilmentsDamage,
  chances: ApplyAilmentsChances,
  rolls: ApplyAilmentsRolls
): void {
  const chanceBleed = clamp01(chances.bleed);
  const chanceIgnite = clamp01(chances.ignite);
  const chancePoison = clamp01(chances.poison);

  if (dealt.physical > 0 && rolls.bleed < chanceBleed) {
    addBleed(state, dealt.physical);
  }

  if (dealt.chaos > 0 && rolls.poison < chancePoison) {
    addPoison(state, dealt.chaos);
  }

  if (dealt.fire > 0 && rolls.ignite < chanceIgnite) {
    applyIgniteStrongestOnly(state, dealt.fire);
  }
}
