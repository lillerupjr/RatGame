export interface RandomRange {
  range(min: number, max: number): number;
}

export interface SpreadDirection {
  dirX: number;
  dirY: number;
  angleRad: number;
  offsetRad: number;
}

/**
 * Apply a symmetric spread cone around an aim direction.
 */
export function applySpreadToDirection(
  aimX: number,
  aimY: number,
  spreadBaseDeg: number,
  rng: RandomRange
): SpreadDirection {
  const aimLen = Math.hypot(aimX, aimY);
  const nx = aimLen > 0.0001 ? aimX / aimLen : 1;
  const ny = aimLen > 0.0001 ? aimY / aimLen : 0;

  const spreadRad = Math.max(0, spreadBaseDeg) * (Math.PI / 180);
  const halfSpread = spreadRad * 0.5;
  const offsetRad = halfSpread > 0 ? rng.range(-halfSpread, halfSpread) : 0;

  const angleRad = Math.atan2(ny, nx) + offsetRad;
  return {
    dirX: Math.cos(angleRad),
    dirY: Math.sin(angleRad),
    angleRad,
    offsetRad,
  };
}

/**
 * Compute projectile angular offsets (radians) centered around 0.
 * For n > 1, offsets are evenly spaced in [-spread/2, +spread/2].
 */
export function computeProjectileAngles(spreadDeg: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  if (n === 1) return [0];

  const spreadRad = Math.max(0, spreadDeg) * (Math.PI / 180);
  if (spreadRad <= 0) return new Array(n).fill(0);

  const half = spreadRad * 0.5;
  const step = spreadRad / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(-half + step * i);
  }
  return out;
}
