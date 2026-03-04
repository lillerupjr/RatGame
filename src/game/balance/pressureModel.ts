export const BASELINE_PLAYER_DPS = 24;

export const PRESSURE_T0 = 0.8;
export const PRESSURE_T120 = 1.6;

export const PRESSURE_LINEAR_DURATION = 120;
export const PRESSURE_DOUBLING_INTERVAL = 60;

export function computePressure(
  tSec: number,
  pressureT0: number = PRESSURE_T0,
  pressureT120: number = PRESSURE_T120
): number {
  const p0 = Math.max(0, pressureT0);
  const p120 = Math.max(0, pressureT120);
  if (tSec <= PRESSURE_LINEAR_DURATION) {
    const k = Math.max(0, tSec) / Math.max(1e-6, PRESSURE_LINEAR_DURATION);
    return p0 + (p120 - p0) * k;
  }

  const extra = Math.max(0, tSec - PRESSURE_LINEAR_DURATION);
  return p120 * Math.pow(2, extra / Math.max(1e-6, PRESSURE_DOUBLING_INTERVAL));
}
