const EPS = 1e-6;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS;
}

export function assertValidDamageBundle(
  physBefore: number,
  fireBefore: number,
  chaosBefore: number,
  physAfter: number,
  fireAfter: number,
  chaosAfter: number,
): void {
  if (physAfter < -EPS || fireAfter < -EPS || chaosAfter < -EPS) {
    throw new Error(
      `Invalid damage bundle: negative component phys=${physAfter}, fire=${fireAfter}, chaos=${chaosAfter}`
    );
  }

  const beforeSum = physBefore + fireBefore + chaosBefore;
  const afterSum = physAfter + fireAfter + chaosAfter;

  if (!nearlyEqual(beforeSum, afterSum)) {
    throw new Error(
      `Conversion violated conservation of damage: before=${beforeSum}, after=${afterSum}`
    );
  }
}

export function assertValidCrit(
  critChance: number,
  critMulti: number
): void {
  if (critChance < -EPS || critChance > 1 + EPS) {
    throw new Error(`critChance out of range: ${critChance}`);
  }
  if (critMulti < 1 - EPS) {
    throw new Error(`critMulti below 1: ${critMulti}`);
  }
}
