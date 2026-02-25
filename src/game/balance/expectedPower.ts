export interface ExpectedDpsPoint {
  tSec: number;
  dps: number;
}

export interface ExpectedPowerConfig {
  timeCurve: ExpectedDpsPoint[];
  depthMultBase: number;
  depthMultPerDepth: number;
  depthMultMin: number;
  depthMultMax: number;
}

export interface ExpectedPowerBudgetConfig {
  basePowerPerSecond: number;
  powerRampPerMinute: number;
  powerRampMax: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function expectedDpsAtTime(cfg: ExpectedPowerConfig, tSec: number): number {
  const curve = cfg.timeCurve;
  if (!curve.length) return 1;
  if (tSec <= curve[0].tSec) return curve[0].dps;
  const last = curve[curve.length - 1];
  if (tSec >= last.tSec) return last.dps;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (tSec >= a.tSec && tSec <= b.tSec) {
      const u = (tSec - a.tSec) / Math.max(1e-6, b.tSec - a.tSec);
      return lerp(a.dps, b.dps, clamp(u, 0, 1));
    }
  }
  return last.dps;
}

export function expectedDpsAtProgress(cfg: ExpectedPowerConfig, tSec: number, depth: number): number {
  const base = expectedDpsAtTime(cfg, tSec);
  const depthMult = clamp(
    cfg.depthMultBase + cfg.depthMultPerDepth * depth,
    cfg.depthMultMin,
    cfg.depthMultMax
  );
  return base * depthMult;
}

export function powerPerSecondAtProgress(
  cfg: ExpectedPowerBudgetConfig,
  tSec: number,
  p0: number,
  p1: number,
  p2: number
): number {
  return cfg.basePowerPerSecond * timePressureMult(tSec, p0, p1, p2);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Time pressure multiplier:
 * - t=0   -> p0
 * - t=60  -> p1
 * - t=120 -> p2
 * - then doubles each minute after 120:
 *   t=180 -> p2*2, t=240 -> p2*4, ...
 */
export function timePressureMult(
  tSec: number,
  p0: number,
  p1: number,
  p2: number
): number {
  const P0 = Math.max(0, p0);
  const P1 = Math.max(0, p1);
  const P2 = Math.max(0, p2);

  if (tSec <= 60) {
    const u = clamp01(tSec / 60);
    return lerp(P0, P1, u);
  }
  if (tSec <= 120) {
    const u = clamp01((tSec - 60) / 60);
    return lerp(P1, P2, u);
  }
  const minutesAfter = (tSec - 120) / 60;
  return P2 * Math.pow(2, minutesAfter);
}
