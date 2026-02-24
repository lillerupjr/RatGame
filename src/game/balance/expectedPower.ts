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
  tSec: number
): number {
  const minutes = tSec / 60;
  const mult = Math.min(cfg.powerRampMax, 1 + cfg.powerRampPerMinute * minutes);
  return cfg.basePowerPerSecond * mult;
}
