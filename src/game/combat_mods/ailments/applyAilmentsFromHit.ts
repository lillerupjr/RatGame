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
  rolls: ApplyAilmentsRolls,
  extra?: {
    poisonFromDamage?: number;
    poisonDamageMult?: number;
    igniteDamageMult?: number;
    poisonDurationMult?: number;
    igniteDurationMult?: number;
    allDamageContributesToPoison?: boolean;
  }
): void {
  const chanceBleed = clamp01(chances.bleed);
  const chanceIgnite = clamp01(chances.ignite);
  const chancePoison = clamp01(chances.poison);
  const poisonDamageMult = Math.max(0, extra?.poisonDamageMult ?? 1);
  const igniteDamageMult = Math.max(0, extra?.igniteDamageMult ?? 1);
  const poisonDurationMult = Math.max(0, extra?.poisonDurationMult ?? 1);
  const igniteDurationMult = Math.max(0, extra?.igniteDurationMult ?? 1);
  const allDamageContributesToPoison = !!extra?.allDamageContributesToPoison;
  const poisonBaseDamage = allDamageContributesToPoison
    ? Math.max(0, dealt.physical + dealt.fire + dealt.chaos)
    : Math.max(0, dealt.chaos);

  if (dealt.physical > 0 && rolls.bleed < chanceBleed) {
    addBleed(state, dealt.physical);
  }

  if (poisonBaseDamage > 0 && rolls.poison < chancePoison) {
    addPoison(state, poisonBaseDamage * poisonDamageMult, { durationMult: poisonDurationMult });
  }

  if (dealt.fire > 0 && rolls.ignite < chanceIgnite) {
    applyIgniteStrongestOnly(state, dealt.fire * igniteDamageMult, { durationMult: igniteDurationMult });
  }

  const extraPoison = Math.max(0, extra?.poisonFromDamage ?? 0) * poisonDamageMult;
  if (extraPoison > 0) {
    addPoison(state, extraPoison, { durationMult: poisonDurationMult });
  }
}
